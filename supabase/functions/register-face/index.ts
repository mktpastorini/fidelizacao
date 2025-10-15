import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import * as faceapi from 'https://esm.sh/face-api.js@0.22.2'
import * as canvas from 'https://esm.sh/canvas@2.11.2'
import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";

// Monkey patch para fazer o face-api.js funcionar no ambiente Deno
faceapi.env.monkeyPatch({ Canvas: canvas.Canvas, Image: canvas.Image, ImageData: canvas.ImageData })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Carrega os modelos de IA uma única vez
const modelsUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
await faceapi.nets.ssdMobilenetv1.loadFromUri(modelsUrl);
await faceapi.nets.faceLandmark68Net.loadFromUri(modelsUrl);
await faceapi.nets.faceRecognitionNet.loadFromUri(modelsUrl);

async function getEmbedding(imageUrl: string): Promise<Float32Array | null> {
  try {
    const img = await canvas.loadImage(imageUrl);
    const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    return detections ? detections.descriptor : null;
  } catch (error) {
    console.error(`Erro ao processar imagem ${imageUrl}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cliente_id, image_urls } = await req.json();
    if (!cliente_id || !Array.isArray(image_urls) || image_urls.length === 0) {
      throw new Error("Payload inválido: cliente_id e um array de image_urls são obrigatórios.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Cabeçalho de autorização não encontrado.");

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");

    // 1. Deletar embeddings antigos para este cliente
    await supabaseAdmin.from('customer_faces').delete().eq('cliente_id', cliente_id);

    // 2. Gerar novos embeddings
    const embeddingPromises = image_urls.map(url => getEmbedding(url));
    const embeddings = (await Promise.all(embeddingPromises)).filter(e => e !== null) as Float32Array[];

    if (embeddings.length === 0) {
      throw new Error("Nenhum rosto foi detectado em nenhuma das imagens fornecidas.");
    }

    // 3. Inserir novos embeddings
    const rowsToInsert = embeddings.map(embedding => ({
      cliente_id: cliente_id,
      user_id: user.id,
      embedding: Array.from(embedding),
      ai_provider: 'face-api.js',
    }));

    const { error: insertError } = await supabaseAdmin.from('customer_faces').insert(rowsToInsert);
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, message: `${embeddings.length} rosto(s) cadastrado(s) com sucesso.` }), {
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