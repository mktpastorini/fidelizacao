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
  console.log("[recognize-face] Buscando configurações globais do CompreFace do usuário 1 (Superadmin principal)...");

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', SUPERADMIN_ID)
    .single();

  if (settingsError) {
    console.error("[recognize-face] Erro ao buscar configurações do usuário 1:", settingsError);
    return { settings: null, error: new Error("Falha ao carregar configurações globais do sistema.") };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin principal.") };
  }

  return { settings, error: null };
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

    // 2. Determinar o ID do usuário (dono do estabelecimento)
    const userIdForClients = SUPERADMIN_ID;
    console.log(`[recognize-face] 2/7: Usando ID fixo para clientes e configurações: ${userIdForClients}`);

    // 3. Buscando configurações do CompreFace do usuário 1
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin);

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

      // 7. Buscar dados do cliente usando user_id = '1' para garantir acesso
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