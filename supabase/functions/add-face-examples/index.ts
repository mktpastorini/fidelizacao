import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do usuário logado
async function getComprefaceSettings(supabaseAdmin: any, userId: string) {
  console.log(`[add-face-examples] Buscando configurações do CompreFace para o usuário: ${userId}`);

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', userId)
    .single();

  if (settingsError) {
    console.error(`[add-face-examples] Erro ao buscar configurações do usuário ${userId}:`, settingsError);
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema.") };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas. Por favor, configure em 'Configurações' > 'Reconhecimento Facial'.") };
  }

  return { settings, error: null };
}

serve(async (req) => {
  console.log("--- [add-face-examples] INICIANDO EXECUÇÃO ---");
  
  if (req.method === 'OPTIONS') {
    console.log("[add-face-examples] Requisição OPTIONS recebida.");
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[add-face-examples] 1/7: Parsing body da requisição...");
    const { subject, image_urls } = await req.json();
    console.log(`[add-face-examples] 1/7: Body recebido - subject: ${subject}, image_urls.length: ${image_urls?.length}`);
    
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      throw new Error(`Parâmetro 'subject' (ID do cliente) inválido ou ausente.`);
    }
    if (!image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      throw new Error("`image_urls` deve ser um array com pelo menos uma URL.");
    }

    console.log("[add-face-examples] 2/7: Autenticando usuário logado...");
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Falha na autenticação do usuário: Token de autorização ausente.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");
    const userId = user.id;
    console.log(`[add-face-examples] 2/7: Usuário autenticado: ${userId}`);

    // 3. Buscando configurações do CompreFace do usuário logado
    console.log("[add-face-examples] 3/7: Buscando configurações do CompreFace...");
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin, userId);

    if (settingsError) {
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    console.log(`[add-face-examples] 3/7: Configurações carregadas.`);

    let successCount = 0;
    const errors = [];

    console.log(`[add-face-examples] 4/7: Iniciando loop para ${image_urls.length} imagens...`);
    for (const [index, imageUrl] of image_urls.entries()) {
      const logPrefix = `[add-face-examples] Imagem ${index + 1}/${image_urls.length}:`;
      console.log(`${logPrefix} Processando URL: ${imageUrl}`);
      
      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        errors.push(`${logPrefix} URL inválida ou vazia.`);
        continue;
      }

      try {
        console.log(`${logPrefix} Baixando imagem...`);
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          errors.push(`${logPrefix} Falha ao baixar imagem (status ${imageResponse.status})`);
          continue;
        }
        
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const base64String = encode(imageArrayBuffer);
        console.log(`${logPrefix} Imagem convertida para base64.`);

        const payload = { file: base64String };
        
        console.log(`${logPrefix} 5/7: Enviando para CompreFace...`);
        // O subject é o ID do cliente, que é único.
        const requestUrl = `${settings.compreface_url}/api/v1/recognition/faces?subject=${encodeURIComponent(subject)}`;
        
        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.compreface_api_key,
          },
          body: JSON.stringify(payload),
        });

        console.log(`${logPrefix} 6/7: Resposta recebida do CompreFace com status: ${response.status}`);
        if (!response.ok) {
          const errorBody = await response.text();
          const errorMsg = `${logPrefix} Falha no envio. Status: ${response.status}. Detalhes: ${errorBody}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        } else {
          console.log(`${logPrefix} Enviada com sucesso.`);
          successCount++;
        }
      } catch (fetchError) {
        const errMsg = `${logPrefix} Erro de rede: ${fetchError.message}`;
        console.error(errMsg);
        errors.push(errMsg);
      }
    }

    console.log(`[add-face-examples] 7/7: Loop concluído. Sucessos: ${successCount}, Erros: ${errors.length}`);
    if (successCount === 0) {
      throw new Error(`Nenhuma imagem foi enviada com sucesso. Último erro: ${errors[errors.length - 1] || 'Erro desconhecido'}`);
    }

    const message = `Enviadas ${successCount} de ${image_urls.length} foto(s).` + (errors.length > 0 ? ` Erros: ${errors.join('; ')}` : '');
    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- [add-face-examples] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});