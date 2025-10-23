import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettings(supabaseAdmin: any) {
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    return { settings: null, error: new Error("Falha ao encontrar o Superadmin principal.") };
  }
  
  const superadminId = superadminProfile.id;

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError) {
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema.") };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas.") };
  }

  return { settings, error: null, superadminId };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { image_url } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    // 1. Autenticação do usuário logado (para garantir que a requisição é válida)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado.");
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");

    // 2. Buscando configurações do CompreFace do Superadmin
    const { settings, error: settingsError, superadminId } = await getComprefaceSettings(supabaseAdmin);
    if (settingsError) throw settingsError;

    const payload = { file: imageData };
    
    // 3. Enviando para CompreFace para reconhecimento
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => response.text());
      if (response.status === 400 && typeof errorBody === 'object' && errorBody.code === 28) {
        return new Response(JSON.stringify({ match: null, distance: null, message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    const bestMatch = data.result?.[0]?.subjects?.[0];

    if (bestMatch && bestMatch.similarity >= 0.85) {
      // 4. Buscar dados do cozinheiro
      const { data: cook, error: cookError } = await supabaseAdmin
        .from('cozinheiros')
        .select('*')
        .eq('id', bestMatch.subject)
        .eq('user_id', superadminId) // Cozinheiros pertencem ao Superadmin
        .single();

      if (cookError) {
        throw new Error(`Match encontrado, mas erro ao buscar dados do cozinheiro: ${cookError.message}`);
      }
      
      return new Response(JSON.stringify({ match: cook, distance: 1 - bestMatch.similarity }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    return new Response(JSON.stringify({ match: null, distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- [recognize-cook-face] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});