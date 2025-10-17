import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getGoogleAuthToken() {
  const client_email = Deno.env.get('GOOGLE_CLIENT_EMAIL');
  const private_key_string = Deno.env.get('GOOGLE_PRIVATE_KEY');

  if (!client_email || !private_key_string) {
    throw new Error("Os secrets GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY devem estar configurados.");
  }

  const formattedPrivateKey = private_key_string.replace(/\\n/g, '\n');
  const scope = "https://www.googleapis.com/auth/cloud-vision";
  const aud = "https://oauth2.googleapis.com/token";

  const jwt = await create({ alg: "RS256", typ: "JWT" }, { iss: client_email, scope, aud, exp: getNumericDate(3600), iat: getNumericDate(0) }, formattedPrivateKey);

  const response = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Erro ao obter token do Google: ${errorBody.error_description}`);
  }
  const { access_token } = await response.json();
  return access_token;
}

async function getGoogleVisionEmbedding(imageUrl: string) {
  const accessToken = await getGoogleAuthToken();
  const imageRequestPayload = imageUrl.startsWith('http') ? { source: { imageUri: imageUrl } } : { content: imageUrl.substring(imageUrl.indexOf(',') + 1) };

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify({ requests: [{ image: imageRequestPayload, features: [{ type: 'FACE_DETECTION' }] }] }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Google Vision API error: ${errorBody.error.message}`);
  }

  const data = await response.json();
  const faceAnnotation = data.responses[0]?.faceAnnotations?.[0];
  if (!faceAnnotation) throw new Error("Nenhum rosto detectado pela Google Vision API.");

  const landmarks = faceAnnotation.landmarks.map((l: any) => [l.position.x, l.position.y, l.position.z]).flat();
  const embedding = Array(512).fill(0);
  for(let i = 0; i < landmarks.length && i < 512; i++) {
    embedding[i] = landmarks[i] / 1000.0;
  }
  return embedding;
}

function euclideanDistance(arr1: number[], arr2: number[]): number {
  if (arr1.length !== arr2.length) {
    console.error(`Incompatibilidade de vetores: ${arr1.length} vs ${arr2.length}`);
    return Infinity;
  }
  return Math.sqrt(arr1.reduce((sum, val, i) => sum + (val - arr2[i]) ** 2, 0));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { image_url, ai_provider } = await req.json();
    if (!image_url || !ai_provider) throw new Error("`image_url` e `ai_provider` são obrigatórios.");

    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const newEmbedding = await getGoogleVisionEmbedding(image_url);

    const { data: faces, error: facesError } = await supabaseAdmin.from('customer_faces').select('cliente_id, embedding').eq('user_id', user.id).eq('ai_provider', ai_provider);
    if (facesError) throw facesError;

    if (!faces || faces.length === 0) {
      return new Response(JSON.stringify({ match: null, distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    let bestMatch = { cliente_id: null, distance: Infinity };
    for (const face of faces) {
      if (face.embedding) {
        const storedEmbedding = JSON.parse(face.embedding);
        const distance = euclideanDistance(newEmbedding, storedEmbedding);
        if (distance < bestMatch.distance) {
          bestMatch = { cliente_id: face.cliente_id, distance };
        }
      }
    }

    const MATCH_THRESHOLD = 0.9;
    if (bestMatch.cliente_id && bestMatch.distance < MATCH_THRESHOLD) {
      const { data: client, error: clientError } = await supabaseAdmin.from('clientes').select('*, filhos(*)').eq('id', bestMatch.cliente_id).single();
      if (clientError) throw clientError;
      return new Response(JSON.stringify({ match: client, distance: bestMatch.distance }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    return new Response(JSON.stringify({ match: null, distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})