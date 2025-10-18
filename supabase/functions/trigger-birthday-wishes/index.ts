import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function personalizeMessage(content: string, client: any): string {
  let personalized = content;
  const clientData = {
    nome: client.nome || '',
    conjuge: client.casado_com || '',
    indicacoes: client.indicacoes?.toString() || '0',
  };

  for (const [key, value] of Object.entries(clientData)) {
    personalized = personalized.replace(new RegExp(`{${key}}`, 'g'), value);
  }

  if (client.gostos && typeof client.gostos === 'object') {
    for (const [key, value] of Object.entries(client.gostos)) {
      personalized = personalized.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
  }

  personalized = personalized.replace(/{[a-zA-Z_]+}/g, '');
  return personalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("=== INICIANDO ENVIO DE MENSAGENS DE ANIVERSÁRIO VIA TRIGGER ===");
    
    // Verificar chave de API no cabeçalho
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Chave de API não fornecida ou inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se a chave de API é válida
    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .eq('api_key', apiKey)
      .single();

    if (settingsError || !userSettings) {
      return new Response(
        JSON.stringify({ error: 'Chave de API inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = userSettings.id;
    console.log(`Usuário autenticado: ${userId}`);

    // Buscar configurações do usuário
    const { data: settings, error: userSettingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, aniversario_template_id')
      .eq('id', userId)
      .single();
    
    if (userSettingsError || !settings?.webhook_url || !settings?.aniversario_template_id) {
      console.error("Configurações incompletas:", { settings, userSettingsError });
      throw new Error('Webhook ou template de aniversário não configurado.');
    }
    console.log("Configurações encontradas:", settings);

    // Buscar o template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('conteudo')
      .eq('id', settings.aniversario_template_id)
      .single();
    if (templateError || !template) {
      console.error("Erro ao buscar template:", templateError);
      throw templateError || new Error("Template não encontrado.");
    }
    console.log("Template encontrado:", template);

    // Buscar aniversariantes do dia para este usuário específico
    const { data: birthdayClients, error: clientsError } = await supabaseAdmin.rpc('get_todays_birthdays_by_user', { p_user_id: userId });
    if (clientsError) {
      console.error("Erro ao buscar aniversariantes:", clientsError);
      throw clientsError;
    }
    
    console.log("Aniversariantes encontrados:", birthdayClients);
    
    if (!birthdayClients || birthdayClients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum aniversariante hoje para notificar." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // Criar logs para cada mensagem
    const logsToInsert = birthdayClients.map(client => ({
      user_id: userId,
      cliente_id: client.id,
      template_id: settings.aniversario_template_id,
      trigger_event: 'aniversario',
      status: 'processando',
    }));

    const { data: insertedLogs, error: logError } = await supabaseAdmin
      .from('message_logs')
      .insert(logsToInsert)
      .select('id, cliente_id');
    if (logError || !insertedLogs) {
      console.error("Erro ao criar logs:", logError);
      throw logError || new Error("Falha ao criar logs de mensagem.");
    }
    console.log("Logs criados:", insertedLogs);

    // Preparar os destinatários
    const recipients = birthdayClients.map(client => {
      const log = insertedLogs.find(l => l.cliente_id === client.id);
      return {
        log_id: log?.id,
        phone: client.whatsapp,
        message: personalizeMessage(template.conteudo, client),
        client_name: client.nome,
        callback_endpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/update-message-status`,
      };
    });

    console.log("Payload para webhook:", { recipients });

    // Enviar para o webhook
    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients }),
    });

    console.log("Resposta do webhook:", webhookResponse.status);

    const responseBody = await webhookResponse.json().catch(() => webhookResponse.text());
    const logIdsToUpdate = insertedLogs.map(l => l.id);

    if (!webhookResponse.ok) {
      await supabaseAdmin.from('message_logs').update({ status: 'falha', error_message: `Webhook falhou: ${webhookResponse.status}`, webhook_response: responseBody }).in('id', logIdsToUpdate);
      throw new Error(`Webhook falhou com status: ${webhookResponse.status}`);
    }

    await supabaseAdmin.from('message_logs').update({ status: 'sucesso', webhook_response: responseBody }).in('id', logIdsToUpdate);

    return new Response(JSON.stringify({ success: true, message: `${recipients.length} mensagens de aniversário enviadas para o webhook.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro ao enviar mensagens de aniversário:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});