import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("--- [recognize-face] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    console.log("[recognize-face] Requisição OPTIONS recebida.");
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("[recognize-face] 1/6: Parsing body da requisição...");
    const { image_url } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log("[recognize-face] 1/6: Body recebido.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
      console.log("[recognize-face] Prefixo data:image removido do base64.");
    }

    console.log("[recognize-face] 2/6: Autenticando usuário...");
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error(`Falha na autenticação do usuário: ${userError?.message || "Usuário não encontrado."}`);
    }
    console.log(`[recognize-face] 2/6: Usuário autenticado: ${user.id}`);

    console.log("[recognize-face] 3/6: Buscando configurações do CompreFace...");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('compreface_url, compreface_api_key')
      .eq('id', user.id)
      .single();

    if (settingsError) {
      throw new Error(`Não foi possível recuperar as configurações do CompreFace: ${settingsError.message}`);
    }
    if (!settings?.compreface_url || !settings?.compreface_api_key) {
      throw new Error("URL ou Chave de API do CompreFace não configuradas.");
    }
    console.log("[recognize-face] 3/6: Configurações carregadas.");

    const payload = { file: imageData };
    console.log("[recognize-face] 4/6: Enviando para CompreFace para reconhecimento...");
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[recognize-face] 5/6: Resposta recebida do CompreFace com status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${errorBody}`);
    }

    const data = await response.json();
    const bestMatch = data.result?.[0]?.subjects?.[0];

    if (bestMatch && bestMatch.similarity >= 0.90) {
      console.log(`[recognize-face] 6/6: Match encontrado - Subject: ${bestMatch.subject}, Similaridade: ${bestMatch.similarity}`);
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clientes')
        .select('*, filhos(*)')
        .eq('id', bestMatch.subject)
        .single();
      if (clientError) {
        throw new Error(`Match encontrado, mas erro ao buscar dados do cliente: ${clientError.message}`);
      }
      console.log("[recognize-face] Dados do cliente recuperados com sucesso.");
      return new Response(JSON.stringify({ match: client, distance: 1 - bestMatch.similarity }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    console.log("[recognize-face] 6/6: Nenhum match encontrado com similaridade suficiente.");
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