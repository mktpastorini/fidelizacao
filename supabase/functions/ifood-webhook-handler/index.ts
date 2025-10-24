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

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // TODO: Implementar a validação de assinatura do webhook do iFood para segurança.
    const payload = await req.json();
    console.log("iFood Webhook Received:", payload);

    const { id: ifoodOrderId, eventType, body } = payload;

    // O user_id do dono do restaurante deve ser passado como parâmetro na URL do webhook
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    if (!userId) {
      throw new Error("user_id é obrigatório na URL do webhook.");
    }

    if (eventType === 'PLACED') {
      // Novo pedido
      const { customer, delivery, items, total } = body;

      const { data: newPedido, error: pedidoError } = await supabaseAdmin
        .from('pedidos')
        .insert({
          user_id: userId,
          order_type: 'IFOOD',
          ifood_order_id: ifoodOrderId,
          status: 'aberto', // O pedido em si está 'aberto', os itens estarão 'pendentes'
          delivery_details: { customer, delivery, total },
        })
        .select('id')
        .single();

      if (pedidoError) throw pedidoError;

      const orderItems = items.map((item: any) => ({
        pedido_id: newPedido.id,
        user_id: userId,
        nome_produto: item.name,
        quantidade: item.quantity,
        preco: item.unitPrice,
        status: 'pendente',
        requer_preparo: true, // Assumimos que todos os itens do iFood requerem preparo
      }));

      const { error: itemsError } = await supabaseAdmin.from('itens_pedido').insert(orderItems);
      if (itemsError) throw itemsError;

    } else if (eventType === 'CANCELLED') {
      // Pedido cancelado
      const { data: pedido, error: findError } = await supabaseAdmin
        .from('pedidos')
        .select('id')
        .eq('ifood_order_id', ifoodOrderId)
        .single();

      if (findError) throw findError;

      // Atualiza o status de todos os itens para 'cancelado'
      await supabaseAdmin
        .from('itens_pedido')
        .update({ status: 'cancelado' })
        .eq('pedido_id', pedido.id);
      
      // Atualiza o status do pedido principal
      await supabaseAdmin
        .from('pedidos')
        .update({ status: 'cancelado', closed_at: new Date().toISOString() })
        .eq('id', pedido.id);
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