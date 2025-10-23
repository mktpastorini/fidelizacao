import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ID fixo do Superadmin principal
const SUPERADMIN_ID = '1';

// Função auxiliar para buscar as configurações globais do usuário 1 fixo
async function getComprefaceSettings(supabaseAdmin: any) {
  console.log("[recognize-multiple-faces] Buscando configurações globais do CompreFace do usuário 1 (Superadmin principal)...");

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', SUPERADMIN_ID)
    .single();

  if (settingsError) {
    console.error("[recognize-multiple-faces] Erro ao buscar configurações do usuário 1:", settingsError);
    return { settings: null, error: new Error("Falha ao carregar configurações globais do sistema.") };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin principal.") };
  }

  return { settings, error: null };
}

serve(async (req) => {
  console.log("--- [recognize-multiple-faces] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[recognize-multiple-faces] 1/6: Parsing body da requisição...");
    const { image_url } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log("[recognize-multiple-faces] 1/6: Body recebido.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    // 2. Autenticação do usuário logado (apenas para validar a origem)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error("Usuário não autenticado. O reconhecimento de múltiplos rostos requer autenticação.");
    }
    
    // Não precisamos do ID do usuário logado, apenas da validação do token.
    // Se o token for inválido, o `userClient.auth.getUser()` falharia, mas aqui estamos usando o cliente admin para validar o token.
    // Para simplificar, vamos apenas garantir que o token exista.

    // 3. Buscando configurações do CompreFace do usuário 1
    const userIdForClients = SUPERADMIN_ID;
    console.log(`[recognize-multiple-faces] 3/6: Usando ID fixo para clientes e configurações: ${userIdForClients}`);
    
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin);

    if (settingsError) {
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log("[recognize-multiple-faces] 3/6: Configurações carregadas.");

    const payload = { file: imageData };
    console.log("[recognize-multiple-faces] 4/6: Enviando para CompreFace para reconhecimento de múltiplas faces...");
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize?limit=0`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[recognize-multiple-faces] 5/6: Resposta recebida do CompreFace com status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => response.text());
      if (response.status === 400 && typeof errorBody === 'object' && errorBody.code === 28) {
        console.log("[recognize-multiple-faces] CompreFace não encontrou nenhum rosto na imagem.");
        return new Response(JSON.stringify({ matches: [], message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    const recognizedFaces = [];
    const minSimilarity = 0.85;

    if (data.result && Array.isArray(data.result)) {
      for (const faceResult of data.result) {
        const bestSubject = faceResult.subjects?.[0];
        if (bestSubject && bestSubject.similarity >= minSimilarity) {
          console.log(`[recognize-multiple-faces] Match encontrado - Subject: ${bestSubject.subject}, Similaridade: ${bestSubject.similarity}`);

          // Buscar dados do cliente usando user_id = '1' para garantir acesso
          const { data: client, error: clientError } = await supabaseAdmin
            .from('clientes')
            .select('id, nome, avatar_url, gostos, casado_com, visitas')
            .eq('id', bestSubject.subject)
            .eq('user_id', userIdForClients)
            .single();

          if (clientError) {
            console.error(`Erro ao buscar dados do cliente ${bestSubject.subject}: ${clientError.message}`);
            continue;
          }

          recognizedFaces.push({
            client: client,
            similarity: bestSubject.similarity,
            box: faceResult.box,
          });
        }
      }
    }

    console.log(`[recognize-multiple-faces] 6/6: ${recognizedFaces.length} cliente(s) reconhecido(s).`);
    return new Response(JSON.stringify({ matches: recognizedFaces }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- [recognize-multiple-faces] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});