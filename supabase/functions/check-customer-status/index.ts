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
    const { cliente_id } = await req.json();
    if (!cliente_id) {
      throw new Error("`cliente_id` é obrigatório.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verifica se o cliente está em alguma mesa com um pedido 'aberto'
    const { data: openOrder, error } = await supabaseAdmin
      .from('mesa_ocupantes')
      .select(`
        pedido:pedidos!inner(id)
      `)
      .eq('cliente_id', cliente_id)
      .eq('pedido.status', 'aberto')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar status do cliente:", error);
      throw new Error("Erro ao consultar o banco de dados.");
    }

    return new Response(JSON.stringify({ hasOpenOrder: !!openOrder }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})