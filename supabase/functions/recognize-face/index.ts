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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("--- RECOGNIZE-FACE: INICIANDO ---");

    const { image_url } = await req.json();
    if (!image_url) {
      throw new Error("Payload inválido: image_url é obrigatório.");
    }
    console.log("RECOGNIZE-FACE: 1/11 - Payload recebido.");
    console.log(`RECOGNIZE-FACE: 2/11 - URL da imagem (iniciais): ${image_url.substring(0, 70)}...`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log("RECOGNIZE-FACE: 3/11 - Cliente Supabase Admin criado.");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não encontrado.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não autenticado.");
    console.log(`RECOGNIZE-FACE: 4/11 - Usuário autenticado: ${user.id}`);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('ai_provider')
      .eq('id', user.id)
      .single();
    
    if (settingsError) throw settingsError;
    const provider = settings?.ai_provider || 'simulacao';
    console.log(`RECOGNIZE-FACE: 5/11 - Provedor de IA: ${provider}`);

    if (provider === 'simulacao') {
      console.log("RECOGNIZE-FACE: 6/11 - Executando simulação...");

      const { data: faces, error: facesError } = await supabaseAdmin
        .from('customer_faces')
        .select('cliente_id')
        .eq('user_id', user.id);

      if (facesError) throw facesError;

      if (!faces || faces.length === 0) {
        console.log("RECOGNIZE-FACE: 7/11 - Simulação: Nenhum rosto cadastrado para simular.");
        return new Response(JSON.stringify({ match: null, message: 'Nenhum cliente correspondente encontrado (simulação).' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // 80% chance of finding a match
      if (Math.random() < 0.8) {
        const randomFace = faces[Math.floor(Math.random() * faces.length)];
        const matchedClientId = randomFace.cliente_id;
        console.log(`RECOGNIZE-FACE: 7/11 - Simulação: Sucesso! Reconhecido cliente ${matchedClientId}`);

        const { data: cliente, error: clientError } = await supabaseAdmin
          .from('clientes')
          .select('*, filhos(*)')
          .eq('id', matchedClientId)
          .single();

        if (clientError) throw clientError;
        console.log("RECOGNIZE-FACE: 8/11 - Detalhes do cliente (simulado) buscados. SUCESSO.");

        return new Response(JSON.stringify({ match: cliente }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        console.log("RECOGNIZE-FACE: 7/11 - Simulação: Falha! Nenhum cliente reconhecido.");
        return new Response(JSON.stringify({ match: null, message: 'Nenhum cliente correspondente encontrado (simulação).' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // --- Logic for Google Vision ---
    let embedding;
    console.log("RECOGNIZE-FACE: 6/11 - Gerando embedding com Google Vision...");
    embedding = await getGoogleVisionEmbedding(image_url);
    console.log("RECOGNIZE-FACE: 7/11 - Embedding do Google Vision gerado.");

    console.log("RECOGNIZE-FACE: 8/11 - Buscando correspondência no DB...");
    const { data: match, error: rpcError } = await supabaseAdmin.rpc('match_customer_face', {
      query_embedding: embedding,
      match_threshold: 0.9,
      match_count: 1,
      provider: provider,
    });

    if (rpcError) throw rpcError;
    console.log("RECOGNIZE-FACE: 9/11 - Busca no DB concluída.");

    if (!match || match.length === 0) {
      console.log("RECOGNIZE-FACE: 10/11 - Nenhuma correspondência encontrada.");
      return new Response(JSON.stringify({ match: null, message: 'Nenhum cliente correspondente encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`RECOGNIZE-FACE: 10/11 - Correspondência encontrada: cliente_id ${match[0].cliente_id}`);
    const { data: cliente, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('*, filhos(*)')
      .eq('id', match[0].cliente_id)
      .single();

    if (clientError) throw clientError;
    console.log("RECOGNIZE-FACE: 11/11 - Detalhes do cliente buscados. SUCESSO.");

    return new Response(JSON.stringify({ match: cliente }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO RECOGNIZE-FACE ---");
    console.error(`MENSAGEM: ${error.message}`);
    console.error(`STACK: ${error.stack}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})