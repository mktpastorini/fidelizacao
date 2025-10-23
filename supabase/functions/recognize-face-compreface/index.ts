import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettings(supabaseAdmin: any, userId: string) {
  console.log(`[recognize-face] Buscando configurações do CompreFace para o usuário: ${userId}`);

  // 1. Buscar o ID do Superadmin
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    console.error("[recognize-face] Erro ao buscar Superadmin:", profileError);
    return { settings: null, error: new Error("Falha ao encontrar o Superadmin principal.") };
  }
  
  const superadminId = superadminProfile.id;
  console.log(`[recognize-face] Superadmin ID encontrado: ${superadminId}`);

  // 2. Buscar as configurações do Superadmin
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError) {
    console.error(`[recognize-face] Erro ao buscar configurações do Superadmin ${superadminId}:`, settingsError);
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema.") };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin. Por favor, configure em 'Configurações' > 'Reconhecimento Facial'.") };
  }

  return { settings, error: null, superadminId };
}

serve(async (req) => {
  console.log("--- [recognize-face] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[recognize-face] 1/7: Parsing body da requisição...");
    const { image_url, mesa_id } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log(`[recognize-face] 1/7: Body recebido. Mesa ID: ${mesa_id}`);

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    // 2. Autenticação do usuário logado para obter o ID
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado. O reconhecimento facial requer autenticação.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");
    const userIdForClients = user.id;
    console.log(`[recognize-face] 2/7: Usuário autenticado: ${userIdForClients}`);


    // 3. Buscando configurações do CompreFace do Superadmin
    const { settings, error: settingsError, superadminId } = await getComprefaceSettings(supabaseAdmin, userIdForClients);

    if (settingsError) {
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log("[recognize-face] 3/7: Configurações carregadas.");

    const payload = { file: imageData };
    console.log("[recognize-face] 4/7: Enviando para CompreFace para reconhecimento...");
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[recognize-face] 5/7: Resposta recebida do CompreFace com status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => response.text());
      if (response.status === 400 && typeof errorBody === 'object' && errorBody.code === 28) {
        console.log("[recognize-face] CompreFace não encontrou um rosto na imagem.");
        return new Response(JSON.stringify({ match: null, distance: null, message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    const bestMatch = data.result?.[0]?.subjects?.[0];

    if (bestMatch && bestMatch.similarity >= 0.85) {
      console.log(`[recognize-face] 6/7: Match encontrado - Subject: ${bestMatch.subject}, Similaridade: ${bestMatch.similarity}`);

      // 7. Buscar dados do cliente usando o ID do usuário logado (dono do cliente)
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clientes')
        .select('*, filhos(*)')
        .eq('id', bestMatch.subject)
        .eq('user_id', userIdForClients)
        .single();

      if (clientError) {
        throw new Error(`Match encontrado, mas erro ao buscar dados do cliente: ${clientError.message}`);
      }
      console.log("[recognize-face] Dados do cliente recuperados com sucesso.");
      return new Response(JSON.stringify({ match: client, distance: 1 - bestMatch.similarity }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    console.log("[recognize-face] 6/7: Nenhum match encontrado com similaridade suficiente.");
    return new Response(JSON.stringify({ match: null, distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- [recognize-face] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});