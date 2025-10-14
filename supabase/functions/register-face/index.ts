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

  function formatPem(pem: string) {
    const base64 = pem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\\n/g, "")
      .replace(/\s/g, "");
    
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    
    const chunks = base64.match(/.{1,64}/g) || [];
    const formattedBase64 = chunks.join('\n');

    return `${pemHeader}\n${formattedBase64}\n${pemFooter}`;
  }

  const formattedPrivateKey = formatPem(private_key_string);

  const scope = "https://www.googleapis.com/auth/cloud-vision";
  const aud = "https://oauth2.googleapis.com/token";

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: client_email,
      scope: scope,
      aud: aud,
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    formattedPrivateKey
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
    if (!base64Image) {
      throw new Error("A imagem (base64) está vazia após o processamento inicial.");
    }
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
    console.log("--- REGISTER-FACE: INICIANDO ---");
    const { cliente_id, image_url } = await req.json();
    if (!cliente_id || !image_url) {
      throw new Error("Payload inválido: cliente_id e image_url são obrigatórios.");
    }
    console.log(`REGISTER-FACE: 1/8 - Payload recebido para cliente ${cliente_id}.`);
    console.log(`REGISTER-FACE: 2/8 - URL da imagem (iniciais): ${image_url.substring(0, 70)}...`);


    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log("REGISTER-FACE: 3/8 - Cliente Supabase Admin criado.");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não encontrado.");
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não autenticado.");
    console.log(`REGISTER-FACE: 4/8 - Usuário autenticado: ${user.id}`);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('ai_provider')
      .eq('id', user.id)
      .single();
    
    if (settingsError) throw settingsError;
    const provider = settings?.ai_provider || 'simulacao';
    console.log(`REGISTER-FACE: 5/8 - Provedor de IA: ${provider}`);

    let embedding;
    if (provider === 'google_vision') {
      console.log("REGISTER-FACE: 6/8 - Gerando embedding com Google Vision...");
      embedding = await getGoogleVisionEmbedding(image_url);
      console.log("REGISTER-FACE: 7/8 - Embedding do Google Vision gerado.");
    } else {
      console.log("REGISTER-FACE: 6/8 - Gerando embedding com Simulação...");
      embedding = getSimulatedEmbedding();
      console.log("REGISTER-FACE: 7/8 - Embedding de simulação gerado.");
    }

    const { error: upsertError } = await supabaseAdmin
      .from('customer_faces')
      .upsert({
        cliente_id: cliente_id,
        user_id: user.id,
        embedding: embedding,
        ai_provider: provider,
      }, { onConflict: 'cliente_id' });

    if (upsertError) throw upsertError;
    console.log("REGISTER-FACE: 8/8 - Embedding salvo no DB. SUCESSO.");

    return new Response(JSON.stringify({ success: true, message: `Rosto cadastrado com sucesso usando ${provider}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO REGISTER-FACE ---");
    console.error(`MENSAGEM: ${error.message}`);
    console.error(`STACK: ${error.stack}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})