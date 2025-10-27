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
    const { mesa_id, cliente_id, user_id } = await req.json();
    if (!mesa_id || !cliente_id || !user_id) {
      throw new Error("mesa_id, cliente_id e user_id são obrigatórios.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verifica se a mesa está realmente livre
    const { data: mesa, error: mesaError } = await supabaseAdmin
      .from('mesas')
      .select('cliente_id')
      .eq('id', mesa_id)
      .single();

    if (mesaError) throw new Error(`Mesa não encontrada: ${mesaError.message}`);
    if (mesa.cliente_id) throw new Error("Esta mesa já foi ocupada por outro cliente.");

    // 2. Aloca o cliente como principal na mesa
    const { error: updateMesaError } = await supabaseAdmin
      .from('mesas')
      .update({ cliente_id: cliente_id })
      .eq('id', mesa_id);
    if (updateMesaError) throw updateMesaError;

    // 3. Garante que um pedido aberto exista para a mesa ANTES de adicionar o ocupante
    const { data: existingPedido, error: findPedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('id')
      .eq('mesa_id', mesa_id)
      .eq('status', 'aberto')
      .maybeSingle();
    
    if (findPedidoError) throw findPedidoError;

    if (!existingPedido) {
      const { data: cliente, error: clienteError } = await supabaseAdmin
        .from('clientes')
        .select('nome')
        .eq('id', cliente_id)
        .single();
      
      if (clienteError) throw new Error(`Erro ao buscar nome do cliente: ${clienteError.message}`);

      // Cria a lista de acompanhantes (que inclui o cliente principal)
      const acompanhantesList = [{ id: cliente_id, nome: cliente.nome || 'Cliente' }];

      const { error: createPedidoError } = await supabaseAdmin
        .from('pedidos')
        .insert({
          mesa_id: mesa_id,
          cliente_id: cliente_id,
          user_id: user_id,
          status: 'aberto',
          acompanhantes: acompanhantesList
        });
      if (createPedidoError) throw createPedidoError;
    }

    // 4. Adiciona o cliente à lista de ocupantes (isso acionará o gatilho do item automático)
    const { error: insertOccupantError } = await supabaseAdmin
      .from('mesa_ocupantes')
      .insert({ mesa_id, cliente_id, user_id });
    if (insertOccupantError) throw insertOccupantError;


    return new Response(JSON.stringify({ success: true, message: "Mesa ocupada com sucesso." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função occupy-table-public:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})