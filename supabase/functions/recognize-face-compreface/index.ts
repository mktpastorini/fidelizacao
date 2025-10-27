import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettingsAndSuperadminId(supabaseAdmin: any) {
  console.log(`[RF-SINGLE] Buscando configurações do CompreFace do Superadmin principal...`);

  // 1. Buscar o ID do Superadmin
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    console.error("[RF-SINGLE] Erro ao buscar Superadmin:", profileError?.message || "Perfil não encontrado.");
    return { settings: null, error: new Error("Falha ao encontrar o Superadmin principal."), superadminId: null };
  }
  
  const superadminId = superadminProfile.id;
  console.log(`[RF-SINGLE] Superadmin ID encontrado: ${superadminId}`);

  // 2. Buscar as configurações do Superadmin
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError) {
    console.error(`[RF-SINGLE] Erro ao buscar configurações do Superadmin ${superadminId}:`, settingsError.message);
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema."), superadminId };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin. Por favor, configure em 'Configurações' > 'Reconhecimento Facial'."), superadminId };
  }

  return { settings, error: null, superadminId };
}

serve(async (req) => {
  console.log("--- [RF-SINGLE] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[RF-SINGLE] 1/7: Parsing body da requisição...");
    const { image_url, min_similarity } = await req.json(); // Adicionado min_similarity
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log("[RF-SINGLE] 1/7: Body recebido.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    console.log("[RF-SINGLE] 2/7: Autenticando usuário logado...");
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado. O reconhecimento facial requer autenticação.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");
    console.log(`[RF-SINGLE] 2/7: Usuário autenticado: ${user.id}`);

    console.log("[RF-SINGLE] 3/7: Buscando configurações do CompreFace e ID do Super Admin...");
    const { settings, error: settingsError, superadminId } = await getComprefaceSettingsAndSuperadminId(supabaseAdmin);

    if (settingsError) {
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!superadminId) throw new Error("ID do Superadmin não encontrado.");
    console.log("[RF-SINGLE] 3/7: Configurações carregadas.");

    const payload = { file: imageData };
    console.log("[RF-SINGLE] 4/7: Enviando para CompreFace para reconhecimento...");
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[RF-SINGLE] 5/7: Resposta recebida do CompreFace com status: ${response.status}`);
    const responseBody = await response.json().catch(() => response.text());
    console.log(`[RF-SINGLE] 5/7: Corpo da resposta do CompreFace:`, JSON.stringify(responseBody));

    if (!response.ok) {
      if (response.status === 400 && typeof responseBody === 'object' && responseBody.code === 28) {
        console.log("[RF-SINGLE] CompreFace não encontrou um rosto na imagem.");
        return new Response(JSON.stringify({ success: true, status: 'NO_FACE_DETECTED', message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(responseBody)}`);
    }

    const bestMatch = responseBody.result?.[0]?.subjects?.[0];
    const minSimilarity = min_similarity ?? 0.85; // Usa o valor recebido ou o padrão

    if (bestMatch) {
      console.log(`[RF-SINGLE] 6/7: Melhor match encontrado - Subject: ${bestMatch.subject}, Similaridade: ${bestMatch.similarity}`);
      if (bestMatch.similarity >= minSimilarity) {
        console.log(`[RF-SINGLE] 7/7: Buscando cliente no DB com ID: ${bestMatch.subject}`);
        const { data: client, error: clientError } = await supabaseAdmin
          .from('clientes')
          .select('*, filhos(*)')
          .eq('id', bestMatch.subject)
          .single();

        if (clientError) {
          if (clientError.code === 'PGRST116') {
              console.warn(`[RF-SINGLE] Cliente ${bestMatch.subject} encontrado no CompreFace, mas não no banco de dados.`);
              return new Response(JSON.stringify({ success: true, status: 'NO_MATCH', message: 'Rosto conhecido, mas não encontrado no sistema.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }
          throw new Error(`Match encontrado, mas erro ao buscar dados do cliente: ${clientError.message}`);
        }
        console.log("[RF-SINGLE] 7/7: Cliente encontrado no DB. Retornando sucesso.");
        return new Response(JSON.stringify({ success: true, status: 'MATCH_FOUND', match: client, similarity: bestMatch.similarity }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      } else {
        console.log(`[RF-SINGLE] Similaridade ${bestMatch.similarity} abaixo do limiar de ${minSimilarity}.`);
        return new Response(JSON.stringify({ success: true, status: 'NO_MATCH', message: `Rosto detectado, mas não reconhecido. (Similaridade: ${(bestMatch.similarity * 100).toFixed(0)}%)`, similarity: bestMatch.similarity }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    console.log("[RF-SINGLE] 6/7: Nenhum match encontrado na resposta do CompreFace.");
    return new Response(JSON.stringify({ success: true, status: 'NO_MATCH', message: 'Rosto detectado, mas não corresponde a nenhum cliente cadastrado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- [RF-SINGLE] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});