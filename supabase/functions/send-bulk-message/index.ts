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

// Função auxiliar para buscar o ID do Superadmin
async function getSuperadminId(supabaseAdmin: any) {
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    throw new Error("Falha ao encontrar o Superadmin principal.");
  }
  return superadminProfile.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { template_id, client_ids } = await req.json();
    if (!template_id || !client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      throw new Error("`template_id` e um array de `client_ids` são obrigatórios.");
    }

    // 1. Autenticar o usuário logado (para garantir que a requisição é válida)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado.");
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");
    
    // 2. Obter o ID do Superadmin (contexto global)
    const superadminId = await getSuperadminId(supabaseAdmin);

    // 3. Buscar configurações (webhook_url) usando o ID do Superadmin
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url')
      .eq('id', superadminId)
      .single();
    if (settingsError || !settings?.webhook_url) {
      throw new Error('URL de Webhook não configurada no perfil do Superadmin.');
    }

    // 4. Buscar o template (que já deve pertencer ao Superadmin, mas verificamos)
    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('conteudo')
      .eq('id', template_id)
      .eq('user_id', superadminId) // Garante que o template é do Superadmin
      .single();
    if (templateError || !template) throw templateError || new Error("Template não encontrado.");

    // 5. Buscar clientes (que pertencem ao Superadmin)
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clientes')
      .select('id, nome, casado_com, indicacoes, gostos, whatsapp')
      .in('id', client_ids)
      .eq('user_id', superadminId); // Garante que os clientes são do Superadmin
    if (clientsError) throw clientsError;

    const validClients = clients.filter(c => c.whatsapp);
    if (validClients.length === 0) {
      throw new Error("Nenhum dos clientes selecionados possui um número de WhatsApp válido.");
    }

    // 6. Criar logs (associados ao Superadmin, pois é o contexto global)
    const logsToInsert = validClients.map(client => ({
      user_id: superadminId, // Log associado ao Superadmin
      cliente_id: client.id,
      template_id: template_id,
      trigger_event: 'manual',
      status: 'processando',
    }));

    const { data: insertedLogs, error: logError } = await supabaseAdmin
      .from('message_logs')
      .insert(logsToInsert)
      .select('id, cliente_id');
    if (logError || !insertedLogs) throw logError || new Error("Falha ao criar logs de mensagem.");

    // 7. Preparar e enviar para o webhook
    const recipients = validClients.map(client => {
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
      await supabaseAdmin
        .from('message_logs')
        .update({ status: 'falha', error_message: `Webhook falhou com status: ${webhookResponse.status}`, webhook_response: responseBody })
        .in('id', logIdsToUpdate);
      throw new Error(`Webhook falhou com status: ${webhookResponse.status}`);
    }

    await supabaseAdmin
      .from('message_logs')
      .update({ status: 'sucesso', webhook_response: responseBody })
      .in('id', logIdsToUpdate);

    return new Response(JSON.stringify({ success: true, message: `${recipients.length} mensagens enviadas para o webhook.` }), {
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