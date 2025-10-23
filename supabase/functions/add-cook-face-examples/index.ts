import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

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

  if (settingsError || !settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin.") };
  }

  return { settings, error: null };
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
    const { subject, image_urls } = await req.json();
    
    if (!subject || !image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      throw new Error("`subject` (ID do cozinheiro) e `image_urls` são obrigatórios.");
    }

    // 1. Autenticação do usuário logado (para garantir que a requisição é válida)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Falha na autenticação do usuário.");
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");

    // 2. Buscando configurações do CompreFace do Superadmin
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin);
    if (settingsError) throw settingsError;

    let successCount = 0;
    const errors = [];

    for (const [index, imageUrl] of image_urls.entries()) {
      const logPrefix = `[add-cook-face] Imagem ${index + 1}/${image_urls.length}:`;
      
      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        errors.push(`${logPrefix} URL inválida ou vazia.`);
        continue;
      }

      try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          errors.push(`${logPrefix} Falha ao baixar imagem (status ${imageResponse.status})`);
          continue;
        }
        
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const base64String = encode(imageArrayBuffer);

        const payload = { file: base64String };
        
        // O subject é o ID do cozinheiro (UUID)
        const requestUrl = `${settings.compreface_url}/api/v1/recognition/faces?subject=${encodeURIComponent(subject)}`;
        
        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.compreface_api_key,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const errorMsg = `${logPrefix} Falha no envio. Status: ${response.status}. Detalhes: ${errorBody}`;
          errors.push(errorMsg);
        } else {
          successCount++;
        }
      } catch (fetchError) {
        const errMsg = `${logPrefix} Erro de rede: ${fetchError.message}`;
        errors.push(errMsg);
      }
    }

    if (successCount === 0) {
      throw new Error(`Nenhuma imagem foi enviada com sucesso. Erros: ${errors.join('; ')}`);
    }

    const message = `Enviadas ${successCount} de ${image_urls.length} foto(s).` + (errors.length > 0 ? ` Erros: ${errors.join('; ')}` : '');
    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});