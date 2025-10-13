import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para gerar um embedding simulado
function getSimulatedEmbedding() {
  const embedding = Array(512).fill(0).map(() => Math.random() * 0.1);
  return embedding;
}

// Função para obter o embedding da Google Cloud Vision API
async function getGoogleVisionEmbedding(imageUrl: string, apiKey: string) {
  let imageRequestPayload;
  if (imageUrl.startsWith('http')) {
    // É uma URL pública
    imageRequestPayload = { source: { imageUri: imageUrl } };
  } else {
    // É uma imagem em base64, remove o prefixo
    const base64Image = imageUrl.replace(/^data:image\/jpeg;base64,/, "");
    imageRequestPayload = { content: base64Image };
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: imageRequestPayload,
        features: [{ type: 'FACE_DETECTION' }],
      }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Google Vision API error: ${errorBody.error.message}`);
  }

  const data = await response.json();
  const faceAnnotation = data.responses[0]?.faceAnnotations?.[0];
  
  if (!faceAnnotation) {
    throw new Error("Nenhum rosto detectado pela Google Vision API.");
  }
  
  const landmarks = faceAnnotation.landmarks.map((l: any) => [l.position.x, l.position.y, l.position.z]).flat();
  const embedding = Array(512).fill(0);
  for(let i = 0; i < landmarks.length && i < 512; i++) {
    embedding[i] = landmarks[i] / 1000.0; // Normaliza
  }

  return embedding;
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (!user) throw new Error("Usuário não autenticado.")

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('ai_provider')
      .eq('id', user.id)
      .single();
    
    if (settingsError) throw settingsError;
    const provider = settings?.ai_provider || 'simulacao';

    let embedding;

    if (provider === 'google_vision') {
      const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
      if (!apiKey) throw new Error("Chave da API do Google Vision não configurada.");
      embedding = await getGoogleVisionEmbedding(image_url, apiKey);
    } else {
      embedding = getSimulatedEmbedding();
    }

    const { data: match, error: rpcError } = await supabaseAdmin.rpc('match_customer_face', {
      query_embedding: embedding,
      match_threshold: 0.9,
      match_count: 1,
      provider: provider,
    })

    if (rpcError) throw rpcError

    if (!match || match.length === 0) {
      return new Response(JSON.stringify({ match: null, message: 'Nenhum cliente correspondente encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

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