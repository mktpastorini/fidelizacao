import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper para converter a chave PEM para o formato que a API de Criptografia espera
function pemToBinary(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr.buffer;
}

// Esta função gera um token de acesso OAuth2 usando as credenciais da Conta de Serviço
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


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const accessToken = await getGoogleAuthToken();
    const testImageUrl = "https://storage.googleapis.com/cloud-samples-data/vision/face/face_no_surprise.jpg";

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: testImageUrl } },
          features: [{ type: 'FACE_DETECTION' }],
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Erro da API do Google com status ${response.status}. Resposta: ${errorText}`;
      try {
        const errorBody = JSON.parse(errorText);
        if (errorBody.error && errorBody.error.message) {
          errorMessage = `Erro da API do Google: ${errorBody.error.message}`;
        }
      } catch (e) { /* O corpo não era JSON, usamos o texto bruto. */ }
      console.error("Google Vision API Error:", errorText);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const faceAnnotation = data.responses[0]?.faceAnnotations?.[0];

    if (!faceAnnotation) {
      return new Response(JSON.stringify({ success: true, message: "Conexão bem-sucedida, mas nenhum rosto detectado na imagem de teste." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Conexão com a Google Vision API funcionando perfeitamente!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})