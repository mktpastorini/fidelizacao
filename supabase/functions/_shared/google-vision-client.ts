import { create, getNumericDate } from "https://deno.land/x/djwt@v2.2/mod.ts";

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

export async function getGoogleVisionEmbedding(imageUrl: string) {
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