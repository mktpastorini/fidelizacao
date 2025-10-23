import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettings(supabaseAdmin: any) {
  console.log("[recognize-multiple-faces] Buscando configurações do CompreFace do Superadmin principal...");

  // 1. Buscar o ID do Superadmin
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    console.error("[recognize-multiple-faces] Erro ao buscar Superadmin:", profileError);
    return { settings: null, error: new Error("Falha ao encontrar o Superadmin principal.") };
  }
  
  const superadminId = superadminProfile.id;
  console.log(`[recognize-multiple-faces] Superadmin ID encontrado: ${superadminId}`);

  // 2. Buscar as configurações do Superadmin
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError) {
    console.error(`[recognize-multiple-faces] Erro ao buscar configurações do Superadmin ${superadminId}:`, settingsError);
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema.") };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin. Por favor, configure em 'Configurações' > 'Reconhecimento Facial'.") };
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

    // 2. Autenticação do usuário logado para obter o ID (necessário para buscar os clientes dele)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado. O reconhecimento de múltiplos rostos requer autenticação.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");
    const userIdForClients = user.id;
    console.log(`[recognize-multiple-faces] 2/6: Usuário autenticado: ${userIdForClients}`);
    
    // 3. Buscando configurações do CompreFace do Superadmin
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

          // Buscar dados do cliente usando o ID do usuário logado (dono do cliente)
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