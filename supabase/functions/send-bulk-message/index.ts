import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { template_id, client_ids } = await req.json();
    if (!template_id || !client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      throw new Error("`template_id` e um array de `client_ids` são obrigatórios.");
    }

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
      .select('webhook_url')
      .eq('id', user.id)
      .single();
    if (settingsError || !settings?.webhook_url) {
      throw new Error('URL de Webhook não configurada.');
    }

    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('conteudo')
      .eq('id', template_id)
      .single();
    if (templateError || !template) throw templateError || new Error("Template não encontrado.");

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clientes')
      .select('id, nome, casado_com, indicacoes, gostos, whatsapp')
      .in('id', client_ids)
      .eq('user_id', user.id);
    if (clientsError) throw clientsError;

    const validClients = clients.filter(c => c.whatsapp);
    if (validClients.length === 0) {
      throw new Error("Nenhum dos clientes selecionados possui um número de WhatsApp válido.");
    }

    const logsToInsert = validClients.map(client => ({
      user_id: user.id,
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

    const recipients = validClients.map(client => {
      const log = insertedLogs.find(l => l.cliente_id === client.id);
      return {
        log_id: log?.id,
        phone: client.whatsapp,
        personalization_data: {
          nome: client.nome,
          conjuge: client.casado_com,
          indicacoes: client.indicacoes,
          ...client.gostos,
        },
      };
    });

    const webhookPayload = {
      message_template: template.conteudo,
      callback_endpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/update-message-status`,
      recipients: recipients,
    };

    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
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