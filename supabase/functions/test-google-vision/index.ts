import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

async function getGoogleAuthToken() {
  console.log("Iniciando getGoogleAuthToken...");
  
  const credsString = Deno.env.get('GOOGLE_CREDENTIALS_JSON');
  if (!credsString) {
    console.error("ERRO: A variável de ambiente GOOGLE_CREDENTIALS_JSON não foi encontrada.");
    throw new Error("A variável de ambiente GOOGLE_CREDENTIALS_JSON não está configurada.");
  }
  console.log("Secret GOOGLE_CREDENTIALS_JSON encontrado. Comprimento:", credsString.length);

  let creds;
  try {
    creds = JSON.parse(credsString);
    console.log("JSON do secret analisado com sucesso. Client email:", creds.client_email);
  } catch (e) {
    console.error("ERRO: Falha ao analisar o JSON do secret.", e.message);
    console.error("O secret começa com:", credsString.substring(0, 50) + "...");
    throw new Error("Falha ao analisar o JSON de GOOGLE_CREDENTIALS_JSON. Verifique se o conteúdo copiado está completo e é um JSON válido.");
  }

  const scope = "https://www.googleapis.com/auth/cloud-vision";
  const aud = "https://oauth2.googleapis.com/token";

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(creds.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );
  console.log("Chave privada importada com sucesso.");

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
  console.log("JWT criado com sucesso.");

  const response = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  console.log("Requisição de token de acesso enviada para o Google.");

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("ERRO do Google ao obter token:", errorBody);
    throw new Error(`Erro ao obter token de acesso do Google: ${errorBody.error_description}`);
  }

  const { access_token } = await response.json();
  console.log("Token de acesso do Google recebido com sucesso.");
  return access_token;
}


serve(async (req) => {
  console.log("Função test-google-vision invocada.");
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const accessToken = await getGoogleAuthToken();
    const testImageUrl = "https://storage.googleapis.com/cloud-samples-data/vision/face/face_no_surprise.jpg";

    console.log("Enviando requisição de teste para a Google Vision API...");
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
    console.log("Resposta da Google Vision API recebida com status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ERRO da Google Vision API:", errorText);
      throw new Error(`Erro da API do Google com status ${response.status}.`);
    }

    const data = await response.json();
    const faceAnnotation = data.responses[0]?.faceAnnotations?.[0];

    if (!faceAnnotation) {
      console.log("Conexão bem-sucedida, mas nenhum rosto detectado na imagem de teste.");
      return new Response(JSON.stringify({ success: true, message: "Conexão bem-sucedida, mas nenhum rosto detectado na imagem de teste." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log("SUCESSO: Conexão com a Google Vision API funcionando perfeitamente!");
    return new Response(JSON.stringify({ success: true, message: "Conexão com a Google Vision API funcionando perfeitamente!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("ERRO CATCH FINAL:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})