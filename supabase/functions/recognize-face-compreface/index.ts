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
    console.log("[recognize-face] 1/7: Parsing body da requisição...");
    const { image_url, mesa_id } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log(`[recognize-face] 1/7: Body recebido. Mesa ID: ${mesa_id}`);

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
      console.log("[recognize-face] Prefixo data:image removido do base64.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let userId: string | null = null;

    // 2. Determinar o ID do usuário (dono do estabelecimento)
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
      // Tenta obter o usuário usando o token fornecido (para usuários logados no painel)
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      
      if (userError || !user) {
        // Se falhar a autenticação do usuário, tentamos o fallback da mesa se houver
        if (mesa_id) {
            console.log("[recognize-face] Falha na autenticação do token do usuário. Tentando buscar user_id pela mesa...");
        } else {
            throw new Error(`Falha na autenticação do usuário: ${userError?.message || "Usuário não encontrado."}`);
        }
      } else {
        userId = user.id;
        console.log(`[recognize-face] 2/7: Usuário autenticado (Painel Admin/Garçom): ${userId}`);
      }
    } 
    
    if (!userId && mesa_id) {
      // Se for requisição anônima do menu público ou falha na autenticação do painel, buscar o user_id pela mesa
      const { data: mesa, error: mesaError } = await supabaseAdmin
        .from('mesas')
        .select('user_id')
        .eq('id', mesa_id)
        .single();
      
      if (mesaError || !mesa?.user_id) {
        throw new Error(`Mesa ID inválido ou usuário da mesa não encontrado: ${mesaError?.message}`);
      }
      userId = mesa.user_id;
      console.log(`[recognize-face] 2/7: Usuário determinado pela Mesa ID: ${userId}`);
    } else if (!userId) {
      throw new Error("ID do usuário ou da mesa é obrigatório para o reconhecimento.");
    }

    // 3. Buscando configurações do CompreFace
    console.log("[recognize-face] 3/7: Buscando configurações do CompreFace...");
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('compreface_url, compreface_api_key')
      .eq('id', userId)
      .single();

    if (settingsError) {
      throw new Error(`Não foi possível recuperar as configurações do CompreFace: ${settingsError.message}`);
    }
    if (!settings?.compreface_url || !settings?.compreface_api_key) {
      throw new Error("URL ou Chave de API do CompreFace não configuradas para este estabelecimento.");
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
      
      // 7. Buscar dados do cliente (usando o ID do cliente e o ID do usuário dono da mesa para RLS)
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clientes')
        .select('*, filhos(*)')
        .eq('id', bestMatch.subject)
        .eq('user_id', userId) // Adiciona filtro de segurança
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