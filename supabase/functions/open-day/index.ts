import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não encontrado.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não autenticado ou token inválido.");

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, daily_report_phone_number')
      .eq('id', user.id)
      .single();
    if (settingsError) throw settingsError;
    if (!settings.webhook_url || !settings.daily_report_phone_number) {
      console.log("Webhook ou número de telefone não configurado. Pulando envio de mensagem de abertura.");
      return new Response(JSON.stringify({ success: true, message: 'Dia aberto, mas mensagem não enviada por falta de configuração.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const now = getBrazilTime();
    const openMessage = `
*Abertura do Dia - ${now.toLocaleDateString('pt-BR')}* ☀️

Seu estabelecimento foi aberto com sucesso às *${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}*.

Desejamos a você um excelente dia de trabalho! 🚀
    `.trim();

    const { data: log, error: logError } = await supabaseAdmin
      .from('message_logs')
      .insert({ user_id: user.id, trigger_event: 'abertura_dia', status: 'processando' })
      .select('id')
      .single();
    if (logError) throw logError;

    const webhookPayload = {
      recipients: [{
        log_id: log.id,
        phone: settings.daily_report_phone_number,
        message: openMessage,
        client_name: "Relatório Diário",
        callback_endpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/update-message-status`,
      }]
    };

    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    const responseBody = await webhookResponse.json().catch(() => webhookResponse.text());

    if (!webhookResponse.ok) {
      await supabaseAdmin.from('message_logs').update({ status: 'falha', error_message: `Webhook falhou: ${webhookResponse.status}`, webhook_response: responseBody }).eq('id', log.id);
      throw new Error(`Webhook falhou com status: ${webhookResponse.status}`);
    }

    await supabaseAdmin.from('message_logs').update({ status: 'sucesso', webhook_response: responseBody }).eq('id', log.id);

    return new Response(JSON.stringify({ success: true, message: 'Mensagem de abertura enviada com sucesso!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO OPEN-DAY ---", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});