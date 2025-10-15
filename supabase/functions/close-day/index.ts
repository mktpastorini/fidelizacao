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
    console.log("--- CLOSE-DAY: INICIANDO EXECUÇÃO ---");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não encontrado.");
    }
    console.log("CLOSE-DAY: 1/8 - Cabeçalho de autorização presente.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log("CLOSE-DAY: 2/8 - Cliente Supabase Admin criado.");

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não autenticado ou token inválido.");
    console.log(`CLOSE-DAY: 3/8 - Usuário autenticado: ${user.id}`);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, daily_report_phone_number')
      .eq('id', user.id)
      .single();
    if (settingsError) throw settingsError;
    if (!settings.webhook_url || !settings.daily_report_phone_number) {
      throw new Error('Configure a URL do webhook e o número de telefone para o relatório diário.');
    }
    console.log("CLOSE-DAY: 4/8 - Configurações de webhook e telefone encontradas.");

    const today = new Date();
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

    const { data: stats, error: statsError } = await supabaseAdmin.rpc('get_stats_by_date_range_for_user', {
      p_user_id: user.id,
      start_date: startOfDay,
      end_date: endOfDay,
    }).single();
    if (statsError) throw statsError;
    console.log("CLOSE-DAY: 5/8 - Estatísticas do dia calculadas.");

    const reportMessage = `
*Resumo do Dia - ${today.toLocaleDateString('pt-BR')}* 📈

Olá! Aqui está o fechamento do seu estabelecimento:

💰 *Faturamento Total:* R$ ${stats.total_revenue.toFixed(2).replace('.', ',')}
🧾 *Total de Pedidos:* ${stats.total_orders}
📊 *Ticket Médio:* R$ ${stats.avg_order_value.toFixed(2).replace('.', ',')}
👥 *Novos Clientes:* ${stats.new_clients}

Um ótimo descanso e até amanhã! ✨
    `.trim();

    const { data: log, error: logError } = await supabaseAdmin
      .from('message_logs')
      .insert({ user_id: user.id, trigger_event: 'fechamento_dia', status: 'processando' })
      .select('id')
      .single();
    if (logError) throw logError;
    console.log(`CLOSE-DAY: 6/8 - Log de mensagem criado com ID: ${log.id}`);

    const webhookPayload = {
      recipients: [{
        log_id: log.id,
        phone: settings.daily_report_phone_number,
        message: reportMessage,
        client_name: "Relatório Diário",
        callback_endpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/update-message-status`,
      }]
    };

    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });
    console.log(`CLOSE-DAY: 7/8 - Webhook enviado. Status: ${webhookResponse.status}`);

    const responseBody = await webhookResponse.json().catch(() => webhookResponse.text());

    if (!webhookResponse.ok) {
      await supabaseAdmin.from('message_logs').update({ status: 'falha', error_message: `Webhook falhou: ${webhookResponse.status}`, webhook_response: responseBody }).eq('id', log.id);
      throw new Error(`Webhook falhou com status: ${webhookResponse.status}`);
    }

    await supabaseAdmin.from('message_logs').update({ status: 'sucesso', webhook_response: responseBody }).eq('id', log.id);
    await supabaseAdmin.from('user_settings').update({ establishment_is_closed: true }).eq('id', user.id);
    console.log("CLOSE-DAY: 8/8 - SUCESSO! Dia fechado e status atualizado.");

    return new Response(JSON.stringify({ success: true, message: 'Dia fechado e relatório enviado com sucesso!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO CLOSE-DAY ---");
    console.error(`MENSAGEM: ${error.message}`);
    console.error(`STACK: ${error.stack}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});