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
    const { mesa_id, cliente_id, user_id } = await req.json();
    if (!mesa_id || !cliente_id || !user_id) {
      throw new Error("mesa_id, cliente_id e user_id são obrigatórios.");
    }

    // 1. Verificar se a mesa está livre
    const { data: mesa, error: mesaError } = await supabaseAdmin
      .from('mesas')
      .select('cliente_id, numero')
      .eq('id', mesa_id)
      .single();
    
    if (mesaError) throw mesaError;
    if (mesa.cliente_id) {
      throw new Error(`A Mesa ${mesa.numero} já está ocupada.`);
    }

    // 2. Ocupar a mesa (set cliente_id)
    const { error: updateMesaError } = await supabaseAdmin
      .from('mesas')
      .update({ cliente_id: cliente_id })
      .eq('id', mesa_id);
    if (updateMesaError) throw updateMesaError;

    // 3. Adicionar o cliente como ocupante (isso dispara o trigger handle_new_occupant_item para criar o pedido e o item automático)
    const { error: insertOccupantError } = await supabaseAdmin
      .from('mesa_ocupantes')
      .insert({ mesa_id, cliente_id, user_id });
    if (insertOccupantError) throw insertOccupantError;
    
    // 4. Enviar mensagem de boas-vindas (opcional, mas bom para o fluxo)
    try {
        const { error: welcomeError } = await supabaseAdmin.functions.invoke('send-welcome-message', {
            body: { clientId: cliente_id, userId: user_id },
        });
        if (welcomeError) console.error(`Falha ao enviar webhook de boas-vindas: ${welcomeError.message}`);
    } catch (e) {
        console.error("Erro ao chamar send-welcome-message:", e.message);
    }

    return new Response(JSON.stringify({ success: true, message: `Mesa ${mesa.numero} ocupada com sucesso!` }), {
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