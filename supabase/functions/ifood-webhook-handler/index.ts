import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ifood-signature',
}

const IFOOD_API_URL = 'https://merchant-api.ifood.com.br';

// Helper function to get iFood API token
async function getIfoodApiToken(clientId: string, clientSecret: string): Promise<string> {
  console.log("iFood Webhook: Obtendo token de autenticação...");
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
  console.log("iFood Webhook: Token obtido com sucesso.");
  return data.accessToken;
}

// Helper function to confirm an order on iFood API
async function confirmIfoodOrder(ifoodOrderId: string, token: string) {
  console.log(`Confirmando pedido ${ifoodOrderId} no iFood...`);
  const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${ifoodOrderId}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao confirmar pedido no iFood. Status: ${response.status}. Detalhes: ${errorBody}`);
  }
  console.log(`Pedido ${ifoodOrderId} confirmado no iFood.`);
}


async function validateSignature(req: Request, bodyText: string): Promise<boolean> {
  const signature = req.headers.get('x-ifood-signature');
  const secret = Deno.env.get('IFOOD_WEBHOOK_SECRET');

  if (!signature || !secret) {
    console.error("iFood Webhook: Assinatura ou segredo ausente. Validação falhou.");
    return false;
  }

  const expectedSignature = hmac('sha256', secret, bodyText, 'hex');
  
  return signature === expectedSignature;
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
    const bodyText = await req.text();
    
    const isSignatureValid = await validateSignature(req, bodyText);
    if (!isSignatureValid) {
      console.warn("iFood Webhook: Tentativa de acesso com assinatura inválida.");
      return new Response(JSON.stringify({ error: "Assinatura inválida." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const payload = JSON.parse(bodyText);
    console.log("iFood Webhook Recebido e Validado:", payload);

    const { id: ifoodEventId, correlationId: ifoodOrderId, code: eventType, body } = payload;

    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    if (!userId) {
      throw new Error("user_id é obrigatório na URL do webhook.");
    }

    switch (eventType) {
      case 'PLACED': {
        const { customer, delivery, items, total } = body;

        // 1. Confirmar o pedido na API do iFood imediatamente
        const ifoodClientId = Deno.env.get('IFOOD_CLIENT_ID');
        const ifoodClientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
        if (!ifoodClientId || !ifoodClientSecret) {
          throw new Error("Credenciais do iFood (IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET) não configuradas.");
        }
        const token = await getIfoodApiToken(ifoodClientId, ifoodClientSecret);
        await confirmIfoodOrder(ifoodOrderId, token);

        // 2. Criar o pedido no banco de dados com o status 'CONFIRMED'
        const { data: newPedido, error: pedidoError } = await supabaseAdmin
          .from('pedidos')
          .insert({
            user_id: userId,
            order_type: 'IFOOD',
            ifood_order_id: ifoodOrderId,
            status: 'aberto',
            delivery_status: 'CONFIRMED', // Alterado para CONFIRMED
            delivery_details: { customer, delivery, total },
          })
          .select('id')
          .single();

        if (pedidoError) throw pedidoError;

        // 3. Criar os itens do pedido com o status 'pendente'
        const orderItems = items.map((item: any) => ({
          pedido_id: newPedido.id,
          user_id: userId,
          nome_produto: item.name,
          quantidade: item.quantity,
          preco: item.unitPrice,
          status: 'pendente', // Alterado para pendente
          requer_preparo: true,
        }));

        const { error: itemsError } = await supabaseAdmin.from('itens_pedido').insert(orderItems);
        if (itemsError) throw itemsError;
        break;
      }
      
      case 'CANCELLED': {
        const { data: pedido, error: findError } = await supabaseAdmin
          .from('pedidos')
          .select('id')
          .eq('ifood_order_id', ifoodOrderId)
          .single();

        if (findError) throw findError;

        await supabaseAdmin
          .from('itens_pedido')
          .update({ status: 'cancelado' })
          .eq('pedido_id', pedido.id);
        
        await supabaseAdmin
          .from('pedidos')
          .update({ status: 'cancelado', closed_at: new Date().toISOString() })
          .eq('id', pedido.id);
        break;
      }

      case 'DELIVERED':
      case 'CONCLUDED': {
        await supabaseAdmin
          .from('pedidos')
          .update({ status: 'pago', closed_at: new Date().toISOString() })
          .eq('ifood_order_id', ifoodOrderId);
        break;
      }
    }

    // Enviar acknowledgment para o iFood no final
    try {
      await supabaseAdmin.functions.invoke('ifood-acknowledgment', {
        body: { events: [{ id: ifoodEventId }] },
      });
      console.log(`iFood Webhook: Acknowledgment enviado para o evento ${ifoodEventId}`);
    } catch (ackError) {
      console.error(`iFood Webhook: Falha ao enviar acknowledgment para o evento ${ifoodEventId}:`, ackError.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro no webhook do iFood:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});