import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pemToBinary(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, ""); // Corrigido para remover apenas newlines
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr.buffer;
}

async function getGoogleAuthToken() {
  const credsString = Deno.env.get('GOOGLE_CREDENTIALS_JSON');
  if (!credsString) {
    throw new Error("A variável de ambiente GOOGLE_CREDENTIALS_JSON não está configurada.");
  }

  const creds = JSON.parse(credsString);
  const scope = "https://www.googleapis.com/auth/cloud-vision";
  const aud = "https://oauth2.googleapis.com/token";

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(creds.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: creds.client_email,
      scope: scope,
      aud: aud,
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    privateKey
  );

  const response = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Erro ao obter token de acesso do Google: ${errorBody.error_description}`);
  }

  const { access_token } = await response.json();
  return access_token;
}

async function getGoogleVisionEmbedding(imageUrl: string) {
  const accessToken = await getGoogleAuthToken();
  let imageRequestPayload;
  if (imageUrl.startsWith('http')) {
    imageRequestPayload = { source: { imageUri: imageUrl } };
  } else {
    const base64Image = imageUrl.substring(imageUrl.indexOf(',') + 1);
    imageRequestPayload = { content: base64Image };
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
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
    embedding[i] = landmarks[i] / 1000.0;
  }

  return embedding;
}

function getSimulatedEmbedding() {
  return Array(512).fill(0).map(() => Math.random() * 0.1);
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
      embedding = await getGoogleVisionEmbedding(image_url);
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