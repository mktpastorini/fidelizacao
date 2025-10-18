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
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, aniversario_template_id')
      .eq('id', user.id)
      .single();
    if (settingsError || !settings?.webhook_url || !settings?.aniversario_template_id) {
      throw new Error('Webhook ou template de aniversário não configurado.');
    }

    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('conteudo')
      .eq('id', settings.aniversario_template_id)
      .single();
    if (templateError || !template) throw templateError || new Error("Template não encontrado.");

    const { data: birthdayClients, error: clientsError } = await supabaseAdmin.rpc('get_todays_birthdays_by_user', { p_user_id: user.id });
    if (clientsError) throw clientsError;
    if (!birthdayClients || birthdayClients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum aniversariante hoje para notificar." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    const logsToInsert = birthdayClients.map(client => ({
      user_id: user.id,
      cliente_id: client.id,
      template_id: settings.aniversario_template_id,
      trigger_event: 'aniversario',
      status: 'processando',
    }));

    const { data: insertedLogs, error: logError } = await supabaseAdmin
      .from('message_logs')
      .insert(logsToInsert)
      .select('id, cliente_id');
    if (logError || !insertedLogs) throw logError || new Error("Falha ao criar logs de mensagem.");

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

    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients }),
    });

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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});