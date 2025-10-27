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

    // Chama a função RPC para verificar se o cliente tem uma conta aberta
    const { data: hasOpenOrder, error } = await supabaseAdmin.rpc('check_client_has_open_order', {
      p_cliente_id: cliente_id,
    });

    if (error) {
      console.error("Erro ao chamar RPC check_client_has_open_order:", error);
      throw new Error("Erro ao consultar o banco de dados.");
    }

    return new Response(JSON.stringify({ hasOpenOrder }), {
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