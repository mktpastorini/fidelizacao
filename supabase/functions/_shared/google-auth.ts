import { create, getNumericDate, verify } from "https://deno.land/x/djwt@v2.2/mod.ts";

// Esta função gera um token de acesso OAuth2 usando as credenciais da Conta de Serviço
export async function getGoogleAuthToken() {
  const credsString = Deno.env.get('GOOGLE_CREDENTIALS_JSON');
  if (!credsString) {
    throw new Error("A variável de ambiente GOOGLE_CREDENTIALS_JSON não está configurada.");
  }

  const creds = JSON.parse(credsString);
  const scope = "https://www.googleapis.com/auth/cloud-vision";
  const aud = "https://oauth2.googleapis.com/token";

  // Importa a chave privada
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBinary(creds.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"]
  );

  // Cria o JWT
  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: creds.client_email,
      scope: scope,
      aud: aud,
      exp: getNumericDate(3600), // Expira em 1 hora
      iat: getNumericDate(0),
    },
    privateKey
  );

  // Troca o JWT por um token de acesso
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