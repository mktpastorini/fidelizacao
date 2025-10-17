import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { image_urls } = await req.json();
    if (!image_urls || !Array.isArray(image_urls)) {
      throw new Error("O corpo da requisição deve conter um array `image_urls`.");
    }
    
    const embeddings = [];
    for (const url of image_urls) {
      try {
        const embedding = await getGoogleVisionEmbedding(url);
        embeddings.push(embedding);
      } catch (e) {
        console.warn(`Não foi possível gerar embedding para a imagem: ${e.message}`);
      }
    }

    if (embeddings.length === 0) {
      throw new Error("Nenhum rosto foi detectado em nenhuma das imagens fornecidas.");
    }

    return new Response(JSON.stringify({ embeddings }), {
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