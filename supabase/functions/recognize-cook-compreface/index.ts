import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettings(supabaseAdmin: any) {
  console.log(`[recognize-cook-compreface] Buscando configurações do CompreFace do Superadmin principal...`);

  // 1. Buscar o ID do Superadmin
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    console.error("[recognize-cook-compreface] Erro ao buscar Superadmin:", profileError?.message || "Perfil não encontrado.");
    return { settings: null, error: new Error("Falha ao encontrar o Superadmin principal."), superadminId: null };
  }
  
  const superadminId = superadminProfile.id;
  console.log(`[recognize-cook-compreface] Superadmin ID encontrado: ${superadminId}`);

  // 2. Buscar as configurações do Superadmin
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError) {
    console.error(`[recognize-cook-compreface] Erro ao buscar configurações do Superadmin ${superadminId}:`, settingsError.message);
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema."), superadminId };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin. Por favor, configure em 'Configurações' > 'Reconhecimento Facial'."), superadminId };
  }

  return { settings, error: null, superadminId };
}

serve(async (req) => {
  console.log("--- [recognize-cook-compreface] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[recognize-cook-compreface] 1/7: Parsing body da requisição...");
    const { image_url } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log("[recognize-cook-compreface] 1/7: Body recebido.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    // 2. Autenticação do usuário logado (apenas para garantir que a requisição é válida)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado. O reconhecimento facial requer autenticação.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");
    console.log(`[recognize-cook-compreface] 2/7: Usuário autenticado: ${user.id}`);


    // 3. Buscando configurações do CompreFace do Superadmin
    const { settings, error: settingsError, superadminId } = await getComprefaceSettings(supabaseAdmin);

    if (settingsError) {
      // Se houver erro nas configurações, retorna 400 para o cliente
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!superadminId) {
        // Isso não deve acontecer se settingsError for null, mas é um fallback seguro
        throw new Error("ID do Superadmin não encontrado após buscar configurações.");
    }

    console.log("[recognize-cook-compreface] 3/7: Configurações carregadas.");

    const payload = { file: imageData };
    console.log("[recognize-cook-compreface] 4/7: Enviando para CompreFace para reconhecimento...");
    
    // Usamos o endpoint de reconhecimento padrão
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[recognize-cook-compreface] 5/7: Resposta recebida do CompreFace com status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => response.text());
      if (response.status === 400 && typeof errorBody === 'object' && errorBody.code === 28) {
        console.log("[recognize-cook-compreface] CompreFace não encontrou um rosto na imagem.");
        return new Response(JSON.stringify({ cook: null, distance: null, message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    const bestMatch = data.result?.[0]?.subjects?.[0];

    if (bestMatch && bestMatch.similarity >= 0.85) {
      console.log(`[recognize-cook-compreface] 6/7: Match encontrado - Subject: ${bestMatch.subject}, Similaridade: ${bestMatch.similarity}`);

      // 7. Buscar dados do cozinheiro
      const { data: cook, error: cookError } = await supabaseAdmin
        .from('cozinheiros')
        .select('*')
        .eq('id', bestMatch.subject)
        .eq('user_id', superadminId) // Cozinheiros devem pertencer ao Superadmin
        .single();

      if (cookError) {
        // Se o cozinheiro não for encontrado (ex: foi deletado do banco mas não do CompreFace)
        if (cookError.code === 'PGRST116') {
            console.warn(`[recognize-cook-compreface] Cozinheiro ${bestMatch.subject} encontrado no CompreFace, mas não no banco de dados.`);
            return new Response(JSON.stringify({ cook: null, distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
        throw new Error(`Match encontrado, mas erro ao buscar dados do cozinheiro: ${cookError.message}`);
      }
      console.log("[recognize-cook-compreface] Dados do cozinheiro recuperados com sucesso.");
      return new Response(JSON.stringify({ cook: cook, distance: 1 - bestMatch.similarity }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    console.log("[recognize-cook-compreface] 6/7: Nenhum match encontrado com similaridade suficiente.");
    return new Response(JSON.stringify({ cook: null, distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- [recognize-cook-compreface] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});