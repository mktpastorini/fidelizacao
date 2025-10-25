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

  let logId: string | null = null;

  try {
    const { orderId, newStatus } = await req.json();
    if (!orderId || !newStatus) {
      throw new Error("`orderId` e `newStatus` são obrigatórios.");
    }

    const superadminId = await getSuperadminId(supabaseAdmin);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .select('cliente_id')
      .eq('id', orderId)
      .eq('user_id', superadminId)
      .single();
    if (orderError || !order?.cliente_id) {
      throw new Error('Pedido ou cliente não encontrado.');
    }
    const clientId = order.cliente_id;

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, delivery_confirmed_template_id, delivery_in_preparation_template_id, delivery_ready_template_id, delivery_out_for_delivery_template_id')
      .eq('id', superadminId)
      .single();
    if (settingsError) throw settingsError;
    if (!settings.webhook_url) throw new Error('Webhook não configurado.');

    const templateIdMap: { [key: string]: string | null | undefined } = {
      'CONFIRMED': settings.delivery_confirmed_template_id,
      'in_preparation': settings.delivery_in_preparation_template_id,
      'ready_for_delivery': settings.delivery_ready_template_id,
      'out_for_delivery': settings.delivery_out_for_delivery_template_id,
    };
    const templateId = templateIdMap[newStatus];

    if (!templateId) {
      return new Response(JSON.stringify({ success: true, message: `Nenhum template configurado para o status '${newStatus}'.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: initialLog, error: logError } = await supabaseAdmin
      .from('message_logs')
      .insert({
        user_id: superadminId,
        cliente_id: clientId,
        template_id: templateId,
        trigger_event: `delivery_${newStatus}`,
        status: 'processando',
      })
      .select('id')
      .single();
    if (logError) throw new Error(`Falha ao criar log: ${logError.message}`);
    logId = initialLog.id;

    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('conteudo')
      .eq('id', templateId)
      .single();
    if (templateError) throw templateError;

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('nome, casado_com, indicacoes, gostos, whatsapp')
      .eq('id', clientId)
      .single();
    if (clientError) throw clientError;
    if (!client.whatsapp) throw new Error('Cliente não possui WhatsApp.');

    const personalizedMessage = personalizeMessage(template.conteudo, client);

    const webhookPayload = {
      recipients: [{
        log_id: logId,
        phone: client.whatsapp,
        message: personalizedMessage,
        client_name: client.nome,
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
      throw new Error(`Webhook falhou com status: ${webhookResponse.status}. Resposta: ${JSON.stringify(responseBody)}`);
    }

    await supabaseAdmin.from('message_logs').update({ status: 'sucesso', webhook_response: responseBody }).eq('id', logId);

    return new Response(JSON.stringify({ success: true, message: 'Webhook de status de delivery enviado.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    if (logId) {
      await supabaseAdmin.from('message_logs').update({ status: 'falha', error_message: error.message }).eq('id', logId);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});