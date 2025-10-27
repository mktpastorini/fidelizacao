import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IFOOD_API_URL = 'https://merchant-api.ifood.com.br';

const statusLabels: { [key: string]: string } = {
  'CONFIRMED': 'Confirmado',
  'in_preparation': 'Em Preparo',
  'ready_for_delivery': 'Pronto para Entrega',
  'out_for_delivery': 'Saiu para Entrega',
};

function personalizeMessage(content: string, client: any, orderDetails: { orderId: string, status: string }): string {
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

  personalized = personalized.replace(/{codigo_pedido}/g, orderDetails.orderId);
  personalized = personalized.replace(/{status_delivery}/g, statusLabels[orderDetails.status] || orderDetails.status);

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

// --- iFood API Helpers ---
async function getIfoodApiToken(clientId: string, clientSecret: string): Promise<string> {
  console.log("iFood Status Update: Obtendo token de autenticação...");
  const params = new URLSearchParams();
  params.append('grantType', 'client_credentials');
  params.append('clientId', clientId);
  params.append('clientSecret', clientSecret);

  const response = await fetch(`${IFOOD_API_URL}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => response.text());
    throw new Error(`Falha ao obter token do iFood. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
  }

  const data = await response.json();
  console.log("iFood Status Update: Token obtido com sucesso.");
  return data.accessToken;
}

async function readyToDeliverIfoodOrder(ifoodOrderId: string, token: string) {
  console.log(`Notificando iFood que o pedido ${ifoodOrderId} está pronto para entrega...`);
  const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${ifoodOrderId}/ready-to-deliver`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao notificar iFood sobre pedido pronto. Status: ${response.status}. Detalhes: ${errorBody}`);
  }
  console.log(`Pedido ${ifoodOrderId} marcado como pronto no iFood.`);
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
      .select('cliente_id, ifood_order_id, order_type')
      .eq('id', orderId)
      .eq('user_id', superadminId)
      .single();
    if (orderError || !order?.cliente_id) {
      throw new Error('Pedido ou cliente não encontrado.');
    }
    const clientId = order.cliente_id;

    // --- NEW IFOOD LOGIC ---
    if (order.order_type === 'IFOOD' && newStatus === 'ready_for_delivery' && order.ifood_order_id) {
      try {
        const ifoodClientId = Deno.env.get('IFOOD_CLIENT_ID');
        const ifoodClientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
        if (!ifoodClientId || !ifoodClientSecret) {
          console.warn("Credenciais do iFood não configuradas. Pulando notificação para o iFood.");
        } else {
          const token = await getIfoodApiToken(ifoodClientId, ifoodClientSecret);
          await readyToDeliverIfoodOrder(order.ifood_order_id, token);
        }
      } catch (ifoodError) {
        console.error("Erro ao notificar o iFood sobre pedido pronto:", ifoodError.message);
        // Não joga o erro para não impedir a notificação do cliente
      }
    }
    // --- END NEW IFOOD LOGIC ---

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, delivery_confirmed_template_id, delivery_in_preparation_template_id, delivery_ready_template_id, delivery_out_for_delivery_template_id')
      .eq('id', superadminId)
      .single();
    if (settingsError) throw settingsError;
    if (!settings.webhook_url) {
      return new Response(JSON.stringify({ success: true, message: 'Webhook não configurado, pulando notificação de cliente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

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

    const displayOrderId = order.ifood_order_id ? `iFood #${order.ifood_order_id.slice(-4)}` : `Pedido #${orderId.slice(0, 4)}`;
    const personalizedMessage = personalizeMessage(template.conteudo, client, { orderId: displayOrderId, status: newStatus });

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