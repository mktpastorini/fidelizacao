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

    // Verifica se o ocupante já existe para evitar duplicatas
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('mesa_ocupantes')
      .select('id')
      .eq('mesa_id', mesa_id)
      .eq('cliente_id', cliente_id)
      .maybeSingle();
    
    if (checkError) throw checkError;

    if (!existing) {
      const { error: insertError } = await supabaseAdmin
        .from('mesa_ocupantes')
        .insert({ mesa_id, cliente_id, user_id });
      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ success: true, message: "Ocupante adicionado ou já existe." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função add-occupant-public:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})