import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do CompreFace
async function getComprefaceSettings(supabaseAdmin: any, userId: string | null) {
  let settings = null;
  let settingsError = null;

  // 1. Tenta buscar as configurações do usuário atual (se houver userId)
  if (userId) {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('compreface_url, compreface_api_key')
      .eq('id', userId)
      .single();
    
    settings = data;
    settingsError = error;
  }

  // 2. Se as configurações do usuário atual estiverem incompletas ou não existirem, busca as do Superadmin/Admin
  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    console.log("[recognize-face] Configurações do usuário atual incompletas. Buscando fallback (Superadmin/Admin)...");
    
    // Primeiro, encontra o ID de um Superadmin ou Admin
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['superadmin', 'admin'])
      .limit(1)
      .single();

    if (adminProfileError || !adminProfile) {
      console.error("[recognize-face] Nenhum Superadmin/Admin encontrado para fallback.");
      return { settings: null, error: new Error("Configurações do CompreFace não encontradas. Configure um Superadmin/Admin.") };
    }

    // Segundo, busca as configurações desse Admin
    const { data: adminSettings, error: adminSettingsError } = await supabaseAdmin
      .from('user_settings')
      .select('compreface_url, compreface_api_key')
      .eq('id', adminProfile.id)
      .single();
      
    if (adminSettingsError) {
      console.error("[recognize-face] Erro ao buscar configurações do Admin:", adminSettingsError);
      return { settings: null, error: new Error("Falha ao carregar configurações de fallback.") };
    }
    
    settings = adminSettings;
  }
  
  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas em nenhum perfil de administrador.") };
  }

  return { settings, error: null };
}


serve(async (req) => {
  console.log("--- [recognize-face] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    console.log("[recognize-face] Requisição OPTIONS recebida.");
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
      console.log("[recognize-face] Prefixo data:image removido do base64.");
    }

    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    // 2. Determinar o ID do usuário (dono do estabelecimento)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // Tenta validar o token do usuário logado (Painel Admin/Garçom)
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      
      if (user && !userError) {
        userId = user.id;
        console.log(`[recognize-face] 2/7: Usuário autenticado (Painel): ${userId}`);
      } else if (mesa_id) {
        console.log("[recognize-face] Falha na autenticação do token do usuário. Tentando buscar user_id pela mesa...");
      } else {
        // Se não há mesa_id e a autenticação falhou, lançamos o erro
        throw new Error(`Falha na autenticação do usuário: ${userError?.message || "Token inválido ou expirado."}`);
      }
    } 
    
    if (!userId && mesa_id) {
      // Se ainda não temos userId, e temos mesa_id (Menu Público ou fallback)
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
    } 
    
    if (!userId) {
      throw new Error("ID do usuário ou da mesa é obrigatório para o reconhecimento.");
    }

    // 3. Buscando configurações do CompreFace (USANDO FUNÇÃO AUXILIAR)
    console.log("[recognize-face] 3/7: Buscando configurações do CompreFace...");
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin, userId);

    if (settingsError) {
      throw settingsError;
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
      
      // 7. Buscar dados do cliente (USANDO SUPABASE ADMIN)
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
    // Garante que a resposta de erro seja 500 e contenha a mensagem de erro
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});