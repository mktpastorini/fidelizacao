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
    const { current_mesa_id, new_mesa_id, cliente_id } = await req.json();
    if (!current_mesa_id || !new_mesa_id || !cliente_id) {
      throw new Error("current_mesa_id, new_mesa_id e cliente_id são obrigatórios.");
    }

    // 1. Autenticação do usuário logado (para fins de auditoria)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Usuário não autenticado.");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");
    const userId = user.id;

    // 2. Buscar pedidos abertos
    const { data: oldPedido, error: oldPedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('id, cliente_id, acompanhantes')
      .eq('mesa_id', current_mesa_id)
      .eq('status', 'aberto')
      .single();
    
    if (oldPedidoError || !oldPedido) {
      throw new Error("Pedido aberto não encontrado na mesa de origem.");
    }

    // 3. Verificar se a nova mesa está livre
    const { data: newMesa, error: newMesaError } = await supabaseAdmin
      .from('mesas')
      .select('cliente_id, numero')
      .eq('id', new_mesa_id)
      .single();
    
    if (newMesaError) throw newMesaError;
    if (newMesa.cliente_id) {
      throw new Error(`A Mesa ${newMesa.numero} já está ocupada. Não é possível transferir.`);
    }

    // 4. Criar novo pedido na nova mesa
    const { data: newPedido, error: newPedidoError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        user_id: userId,
        mesa_id: new_mesa_id,
        cliente_id: cliente_id,
        status: 'aberto',
        acompanhantes: [{ id: cliente_id, nome: (await supabaseAdmin.from('clientes').select('nome').eq('id', cliente_id).single()).data?.nome || 'Cliente' }],
      })
      .select('id')
      .single();
    if (newPedidoError) throw newPedidoError;

    // 5. Mover itens individuais do cliente para o novo pedido
    const { error: updateItemsError } = await supabaseAdmin
      .from('itens_pedido')
      .update({ 
        pedido_id: newPedido.id,
        updated_at: new Date().toISOString(),
      })
      .eq('pedido_id', oldPedido.id)
      .eq('consumido_por_cliente_id', cliente_id);
    if (updateItemsError) throw updateItemsError;

    // 6. Remover o cliente da lista de acompanhantes do pedido antigo
    const updatedAcompanhantes = (oldPedido.acompanhantes || []).filter((a: any) => a.id !== cliente_id);
    
    await supabaseAdmin
      .from('pedidos')
      .update({ acompanhantes: updatedAcompanhantes })
      .eq('id', oldPedido.id);

    // 7. Remover o cliente da tabela de ocupantes da mesa antiga
    await supabaseAdmin
      .from('mesa_ocupantes')
      .delete()
      .eq('mesa_id', current_mesa_id)
      .eq('cliente_id', cliente_id);

    // 8. Adicionar o cliente como ocupante na nova mesa (dispara o trigger de visita)
    await supabaseAdmin
      .from('mesa_ocupantes')
      .insert({ mesa_id: new_mesa_id, cliente_id, user_id: userId });

    // 9. Ocupar a nova mesa (cliente principal)
    await supabaseAdmin
      .from('mesas')
      .update({ cliente_id: cliente_id })
      .eq('id', new_mesa_id);

    // 10. Verificar se o pedido antigo ficou vazio
    const { count: remainingItemsCount } = await supabaseAdmin
      .from('itens_pedido')
      .select('id', { count: 'exact', head: true })
      .eq('pedido_id', oldPedido.id);

    if (remainingItemsCount === 0) {
      // Se o pedido antigo ficou vazio, cancela-o e libera a mesa antiga
      await supabaseAdmin
        .from('pedidos')
        .update({ status: 'cancelado', closed_at: new Date().toISOString() })
        .eq('id', oldPedido.id);
        
      await supabaseAdmin
        .from('mesas')
        .update({ cliente_id: null })
        .eq('id', current_mesa_id);
        
      await supabaseAdmin
        .from('mesa_ocupantes')
        .delete()
        .eq('mesa_id', current_mesa_id);
    } else if (oldPedido.cliente_id === cliente_id) {
        // Se o cliente transferido era o principal do PEDIDO, o pedido antigo fica sem cliente principal.
        await supabaseAdmin
            .from('pedidos')
            .update({ cliente_id: null })
            .eq('id', oldPedido.id);
        
        // Se o cliente transferido era o principal da MESA, a MESA deve ser liberada.
        // Os ocupantes restantes (se houver) permanecem como ocupantes.
        await supabaseAdmin
            .from('mesas')
            .update({ cliente_id: null })
            .eq('id', current_mesa_id);
    }


    return new Response(JSON.stringify({ success: true, message: `Cliente transferido para a Mesa ${newMesa.numero} com sucesso!` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função transfer-client-to-table:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})