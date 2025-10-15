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

async function getEmbedding(imageUrl: string): Promise<Float32Array> {
  const img = await canvas.loadImage(imageUrl);
  const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
  if (!detections) {
    throw new Error("Nenhum rosto detectado na imagem.");
  }
  return detections.descriptor;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cliente_id, image_url } = await req.json();
    if (!cliente_id || !image_url) {
      throw new Error("Payload inválido: cliente_id e image_url são obrigatórios.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Cabeçalho de autorização não encontrado.");

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");

    const embedding = await getEmbedding(image_url);

    const { error: upsertError } = await supabaseAdmin
      .from('customer_faces')
      .upsert({
        cliente_id: cliente_id,
        user_id: user.id,
        embedding: Array.from(embedding),
        ai_provider: 'face-api.js', // Especifica o provedor
      }, { onConflict: 'cliente_id' });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, message: `Rosto cadastrado com sucesso.` }), {
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