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
    const { image_url } = await req.json()
    if (!image_url) {
      throw new Error("image_url é obrigatório.")
    }

    // =================================================================
    // TODO: Substituir esta simulação por uma chamada a um serviço de IA real.
    // Esta seção deve enviar a 'image_url' para um serviço de IA
    // e receber um vetor de embedding para a busca.
    // Por enquanto, estamos gerando o mesmo vetor de teste estático.
    const embedding = Array(512).fill(0);
    embedding[0] = 0.1;
    // =================================================================

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Usa a função RPC para encontrar o rosto mais parecido no banco de dados.
    const { data: match, error: rpcError } = await supabaseAdmin.rpc('match_customer_face', {
      query_embedding: embedding,
      match_threshold: 0.9, // Nível de confiança (90%)
      match_count: 1,
    })

    if (rpcError) throw rpcError

    if (!match || match.length === 0) {
      return new Response(JSON.stringify({ match: null, message: 'Nenhum cliente correspondente encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Se encontrou uma correspondência, busca os dados completos do cliente.
    const { data: cliente, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('*, filhos(*)')
      .eq('id', match[0].cliente_id)
      .single()

    if (clientError) throw clientError

    return new Response(JSON.stringify({ match: cliente }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})