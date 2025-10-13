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
    const { cliente_id, image_url } = await req.json()
    if (!cliente_id || !image_url) {
      throw new Error("cliente_id e image_url são obrigatórios.")
    }

    // =================================================================
    // TODO: Substituir esta simulação por uma chamada a um serviço de IA real.
    // Esta seção deve enviar a 'image_url' para um serviço de IA
    // (como Rekognition, Face API, etc.) e receber um vetor de embedding.
    // Por enquanto, estamos gerando um vetor de teste estático.
    const embedding = Array(512).fill(0);
    embedding[0] = 0.1; // Adiciona uma pequena variação para garantir que não seja um vetor nulo
    // =================================================================

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (!user) throw new Error("Usuário não autenticado.")

    // Salva o embedding no banco de dados, associado ao cliente.
    // Usamos upsert para permitir que o rosto de um cliente seja recadastrado.
    const { error } = await supabaseAdmin
      .from('customer_faces')
      .upsert({
        cliente_id: cliente_id,
        user_id: user.id,
        embedding: embedding,
      }, { onConflict: 'cliente_id' })

    if (error) throw error

    return new Response(JSON.stringify({ success: true, message: 'Rosto cadastrado com sucesso.' }), {
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