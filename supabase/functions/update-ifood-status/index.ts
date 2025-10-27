import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IFOOD_API_URL = 'https://merchant-api.ifood.com.br';

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

async function dispatchIfoodOrder(ifoodOrderId: string, token: string) {
  console.log(`Despachando pedido ${ifoodOrderId} no iFood...`);
  const response = await fetch(`${IFOOD_API_URL}/order/v1.0/orders/${ifoodOrderId}/dispatch`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao despachar pedido no iFood. Status: ${response.status}. Detalhes: ${errorBody}`);
  }
  console.log(`Pedido ${ifoodOrderId} despachado no iFood.`);
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
    const { pedido_id, new_status } = await req.json();
    if (!pedido_id || !new_status) {
      throw new Error("`pedido_id` e `new_status` são obrigatórios.");
    }

    // Autenticação do usuário que fez a ação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Usuário não autenticado.");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw userError;

    // Buscar o pedido para obter o ifood_order_id
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('ifood_order_id, order_type')
      .eq('id', pedido_id)
      .single();

    if (pedidoError) throw pedidoError;
    if (pedido.order_type !== 'IFOOD' || !pedido.ifood_order_id) {
      return new Response(JSON.stringify({ success: true, message: "Não é um pedido do iFood, nenhuma ação necessária." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const ifoodClientId = Deno.env.get('IFOOD_CLIENT_ID');
    const ifoodClientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
    if (!ifoodClientId || !ifoodClientSecret) {
      throw new Error("Credenciais do iFood não configuradas como secrets.");
    }

    const token = await getIfoodApiToken(ifoodClientId, ifoodClientSecret);

    // A confirmação já é feita pelo webhook. Apenas o despacho é necessário aqui.
    if (new_status === 'out_for_delivery') {
      await dispatchIfoodOrder(pedido.ifood_order_id, token);
    }

    return new Response(JSON.stringify({ success: true, message: `Status do pedido ${pedido.ifood_order_id} atualizado no iFood.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro ao atualizar status no iFood:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})