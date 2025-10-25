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
    // 1. Authenticate via API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Chave de API não fornecida ou inválida.');
    }
    const apiKey = authHeader.substring(7);

    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .eq('api_key', apiKey)
      .single();

    if (settingsError || !userSettings) {
      throw new Error('Chave de API inválida.');
    }
    const userId = userSettings.id;

    // 2. Validate request body
    const { cliente_id, items, channel, delivery_address } = await req.json();
    if (!cliente_id || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error("`cliente_id` e um array `items` são obrigatórios.");
    }

    // 3. Fetch customer and product data
    const { data: cliente, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .eq('user_id', userId)
      .single();
    if (clientError || !cliente) {
      throw new Error("Cliente não encontrado ou não pertence a este usuário.");
    }

    const productIds = items.map(item => item.produto_id);
    const { data: produtos, error: productsError } = await supabaseAdmin
      .from('produtos')
      .select('id, nome, preco, requer_preparo')
      .in('id', productIds)
      .eq('user_id', userId);
    if (productsError) throw productsError;
    if (produtos.length !== productIds.length) {
      throw new Error("Um ou mais IDs de produto são inválidos.");
    }
    const productMap = new Map(produtos.map(p => [p.id, p]));

    // 4. Construct delivery details
    const finalAddress = delivery_address || {
      streetName: cliente.address_street,
      streetNumber: cliente.address_number,
      neighborhood: cliente.address_neighborhood,
      city: cliente.address_city,
      postalCode: cliente.address_zip,
      complement: cliente.address_complement,
    };

    const deliveryDetails = {
      customer: { name: cliente.nome, phone: cliente.whatsapp },
      delivery: { deliveryAddress: finalAddress },
      channel: channel || 'api',
    };

    // 5. Create the order
    const { data: newPedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        user_id: userId,
        cliente_id: cliente_id,
        order_type: 'DELIVERY',
        delivery_status: 'awaiting_confirmation',
        status: 'aberto',
        delivery_details: deliveryDetails,
      })
      .select('id')
      .single();
    if (pedidoError) throw pedidoError;

    // 6. Create order items
    const orderItems = items.map((item: any) => {
      const produto = productMap.get(item.produto_id);
      return {
        pedido_id: newPedido.id,
        user_id: userId,
        nome_produto: produto.nome,
        quantidade: item.quantidade,
        preco: produto.preco,
        status: 'pendente',
        requer_preparo: produto.requer_preparo,
        consumido_por_cliente_id: cliente_id,
      };
    });

    const { error: itemsError } = await supabaseAdmin.from('itens_pedido').insert(orderItems);
    if (itemsError) throw itemsError;

    // 7. Return success
    return new Response(JSON.stringify({ success: true, message: "Pedido de delivery criado com sucesso.", order_id: newPedido.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });

  } catch (error) {
    console.error("Erro na função create-delivery-order:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})