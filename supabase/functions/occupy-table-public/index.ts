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
    const { mesa_id, cliente_id } = await req.json();
    if (!mesa_id || !cliente_id) {
      throw new Error("`mesa_id` e `cliente_id` são obrigatórios.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Verifica se a mesa está realmente livre e obtém o user_id
    const { data: mesa, error: mesaError } = await supabaseAdmin
      .from('mesas')
      .select('cliente_id, user_id')
      .eq('id', mesa_id)
      .single();

    if (mesaError) throw new Error(`Mesa não encontrada: ${mesaError.message}`);
    if (mesa.cliente_id) throw new Error("Esta mesa já foi ocupada por outro cliente.");
    
    const userId = mesa.user_id;

    // 2. Ocupa a mesa
    const { error: updateMesaError } = await supabaseAdmin
      .from('mesas')
      .update({ cliente_id: cliente_id })
      .eq('id', mesa_id);
    if (updateMesaError) throw updateMesaError;

    // 3. Adiciona o cliente como o primeiro ocupante
    const { error: insertOccupantError } = await supabaseAdmin
      .from('mesa_ocupantes')
      .insert({ mesa_id, cliente_id, user_id: userId });
    if (insertOccupantError) throw insertOccupantError;

    // 4. Cria o pedido aberto
    const { data: clienteData } = await supabaseAdmin.from('clientes').select('nome').eq('id', cliente_id).single();
    const { error: insertPedidoError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        mesa_id,
        cliente_id,
        user_id: userId,
        status: 'aberto',
        acompanhantes: [{ id: cliente_id, nome: clienteData?.nome || 'Cliente' }],
      });
    if (insertPedidoError) throw insertPedidoError;

    // 5. (Opcional) Dispara a mensagem de boas-vindas
    try {
      await supabaseAdmin.functions.invoke('send-welcome-message', {
        body: { clientId: cliente_id, userId },
      });
    } catch (e) {
      console.warn(`Falha ao enviar mensagem de boas-vindas: ${e.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Mesa ocupada com sucesso!" }), {
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