import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para gerar um embedding simulado (nosso sistema antigo)
function getSimulatedEmbedding() {
  const embedding = Array(512).fill(0).map(() => Math.random() * 0.1);
  return embedding;
}

// Função para obter o embedding da Google Cloud Vision API
async function getGoogleVisionEmbedding(imageUrl: string, apiKey: string) {
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { source: { imageUri: imageUrl } },
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
  
  // A API do Google Vision não retorna um vetor de embedding diretamente.
  // Ela retorna pontos de referência (landmarks). Para um sistema de reconhecimento real,
  // precisaríamos de um modelo que gere embeddings, como o da Face API do Azure ou um modelo customizado.
  // Para este exemplo, vamos simular um embedding a partir dos landmarks para manter o fluxo.
  if (!faceAnnotation) {
    throw new Error("Nenhum rosto detectado pela Google Vision API.");
  }
  
  // Simulação de embedding a partir dos dados do Google
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
    const { cliente_id, image_url } = await req.json()
    if (!cliente_id || !image_url) {
      throw new Error("cliente_id e image_url são obrigatórios.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
    if (!user) throw new Error("Usuário não autenticado.")

    // 1. Descobre qual IA o usuário selecionou
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('ai_provider')
      .eq('id', user.id)
      .single();
    
    if (settingsError) throw settingsError;
    const provider = settings?.ai_provider || 'simulacao';

    let embedding;

    // 2. Gera o embedding usando o provedor correto
    if (provider === 'google_vision') {
      const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
      if (!apiKey) throw new Error("Chave da API do Google Vision não configurada.");
      embedding = await getGoogleVisionEmbedding(image_url, apiKey);
    } else {
      embedding = getSimulatedEmbedding();
    }

    // 3. Salva o embedding e o provedor no banco de dados
    const { error: upsertError } = await supabaseAdmin
      .from('customer_faces')
      .upsert({
        cliente_id: cliente_id,
        user_id: user.id,
        embedding: embedding,
        ai_provider: provider,
      }, { onConflict: 'cliente_id' })

    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ success: true, message: `Rosto cadastrado com sucesso usando ${provider}.` }), {
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