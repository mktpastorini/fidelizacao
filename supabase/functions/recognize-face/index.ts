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
    const { image_url } = await req.json();
    if (!image_url) throw new Error("Payload inválido: image_url é obrigatório.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Cabeçalho de autorização não encontrado.");
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");

    const { data: settings } = await supabaseAdmin.from('user_settings').select('ai_provider').eq('id', user.id).single();
    const provider = settings?.ai_provider || 'simulacao';

    if (provider === 'simulacao') {
      // Lógica de simulação mantida como fallback
      const { data: faces } = await supabaseAdmin.from('customer_faces').select('cliente_id').eq('user_id', user.id);
      if (!faces || faces.length === 0) return new Response(JSON.stringify({ match: null }));
      if (Math.random() < 0.5) {
        const randomFace = faces[Math.floor(Math.random() * faces.length)];
        const { data: cliente } = await supabaseAdmin.from('clientes').select('*, filhos(*)').eq('id', randomFace.cliente_id).single();
        return new Response(JSON.stringify({ match: cliente }));
      }
      return new Response(JSON.stringify({ match: null }));
    }

    // Lógica de reconhecimento real
    const embedding = await getEmbedding(image_url);

    const { data: match, error: rpcError } = await supabaseAdmin.rpc('match_face', {
      query_embedding: Array.from(embedding),
      match_threshold: 0.5, // Limiar de confiança (0.6 é o padrão, 0.5 é mais estrito)
      match_count: 1,
    });

    if (rpcError) throw rpcError;

    if (!match || match.length === 0) {
      return new Response(JSON.stringify({ match: null, message: 'Nenhum cliente correspondente encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { data: cliente, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('*, filhos(*)')
      .eq('id', match[0].cliente_id)
      .single();

    if (clientError) throw clientError;

    return new Response(JSON.stringify({ match: cliente }), {
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