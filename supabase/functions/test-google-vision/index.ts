import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function pemToBinary(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr.buffer;
}

async function getGoogleAuthToken() {
  console.log("Tentando obter o token de autenticação do Google...");
  const client_email = Deno.env.get('GOOGLE_CLIENT_EMAIL');
  const private_key = Deno.env.get('GOOGLE_PRIVATE_KEY');

  if (!client_email || !private_key) {
    console.error("ERRO: Secrets 'GOOGLE_CLIENT_EMAIL' ou 'GOOGLE_PRIVATE_KEY' não encontrados.");
    throw new Error("Os secrets GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY devem estar configurados.");
  }
  console.log("Secrets encontrados. Prosseguindo com a criação do token.");

  const scope = "https://www.googleapis.com/auth/cloud-vision";
  const aud = "https://oauth2.googleapis.com/token";

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );
  console.log("Chave privada importada com sucesso.");

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: client_email,
      scope: scope,
      aud: aud,
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    cryptoKey
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

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("Erro na resposta do Google OAuth:", errorBody);
    throw new Error(`Erro ao obter token de acesso do Google: ${errorBody.error_description}`);
  }

  const { access_token } = await response.json();
  console.log("Token de acesso do Google obtido com sucesso.");
  return access_token;
}


serve(async (req) => {
  console.log("--- INICIANDO TESTE DE CONEXÃO GOOGLE VISION ---");
  const clientEmailExists = !!Deno.env.get('GOOGLE_CLIENT_EMAIL');
  const privateKeyExists = !!Deno.env.get('GOOGLE_PRIVATE_KEY');
  console.log("Verificando a existência de secrets...");
  console.log("Secret 'GOOGLE_CLIENT_EMAIL' encontrado:", clientEmailExists);
  console.log("Secret 'GOOGLE_PRIVATE_KEY' encontrado:", privateKeyExists);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const accessToken = await getGoogleAuthToken();
    const testImageUrl = "https://storage.googleapis.com/cloud-samples-data/vision/face/face_no_surprise.jpg";
    console.log("Enviando requisição para a API do Google Vision...");

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
    console.log(`Resposta da API do Google: Status ${response.status}`);

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
    console.error("ERRO CATCH FINAL:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})