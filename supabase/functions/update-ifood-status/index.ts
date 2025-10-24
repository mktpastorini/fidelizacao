import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mock da API do iFood - substitua pelas URLs e lógica de autenticação reais
async function getIfoodApiToken(clientId: string, clientSecret: string) {
  // Lógica para obter o token de autenticação da API do iFood
  console.log("Obtendo token do iFood...");
  return "mock_ifood_api_token";
}

async function confirmIfoodOrder(ifoodOrderId: string, token: string) {
  console.log(`Confirmando pedido ${ifoodOrderId} no iFood...`);
  // const response = await fetch(`https://api.ifood.com.br/v1/orders/${ifoodOrderId}/confirm`, {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${token}` }
  // });
  // if (!response.ok) throw new Error("Falha ao confirmar pedido no iFood.");
}

async function dispatchIfoodOrder(ifoodOrderId: string, token: string) {
  console.log(`Despachando pedido ${ifoodOrderId} no iFood...`);
  // const response = await fetch(`https://api.ifood.com.br/v1/orders/${ifoodOrderId}/dispatch`, {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${token}` }
  // });
  // if (!response.ok) throw new Error("Falha ao despachar pedido no iFood.");
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
      return new Response(JSON.stringify({ success: true, message: "Não é um pedido do iFood." }), {
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

    if (new_status === 'preparando') {
      await confirmIfoodOrder(pedido.ifood_order_id, token);
    } else if (new_status === 'entregue') {
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
});