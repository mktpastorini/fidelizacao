import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. Parse request body
    const { subject, image_urls } = await req.json();
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      throw new Error(`Parâmetro 'subject' (ID do cliente) inválido ou ausente.`);
    }
    if (!image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      throw new Error("`image_urls` deve ser um array com pelo menos uma URL.");
    }

    // 2. Authenticate user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
        console.error("Erro de autenticação:", userError?.message || "Usuário não encontrado.");
        throw new Error("Falha na autenticação do usuário.");
    }

    // 3. Fetch user settings using admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('compreface_url, compreface_api_key')
      .eq('id', user.id)
      .single();

    // 4. Validate settings
    if (settingsError) {
      console.error(`Erro ao buscar configurações para o usuário ${user.id}:`, settingsError.message);
      if (settingsError.code === 'PGRST116') {
        throw new Error("Nenhuma configuração encontrada para este usuário. O perfil pode estar incompleto.");
      }
      throw new Error("Não foi possível recuperar as configurações do CompreFace. Verifique a página de Configurações.");
    }
    if (!settings?.compreface_url || !settings?.compreface_api_key) {
      throw new Error("URL ou Chave de API do CompreFace não configuradas. Verifique a página de Configurações.");
    }

    // 5. Loop through images and send to CompreFace
    let successCount = 0;
    const errors = [];

    for (const imageUrl of image_urls) {
      try {
        const response = await fetch(`${settings.compreface_url}/api/v1/recognition/faces`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.compreface_api_key,
            'User-Agent': 'Fidelize-App/1.0'
          },
          body: JSON.stringify({
            file: imageUrl,
            subject: subject,
          }),
        });

        if (!response.ok) {
          let errorMsg = `Falha ao enviar imagem. Status: ${response.status}`;
          try {
            const errorBody = await response.json();
            errorMsg += `. Detalhes: ${errorBody.message || JSON.stringify(errorBody)}`;
          } catch (e) {
            errorMsg += `. Detalhes: ${await response.text()}`;
          }
          errors.push(errorMsg);
        } else {
            successCount++;
        }
      } catch (fetchError) {
        errors.push(`Erro de rede ao enviar imagem: ${fetchError.message}`);
      }
    }

    // 6. Handle results
    if (successCount === 0) {
        throw new Error(`Nenhuma imagem foi enviada com sucesso. Último erro: ${errors[errors.length - 1] || 'Erro desconhecido'}`);
    }

    const message = `Enviadas ${successCount} de ${image_urls.length} foto(s) para o CompreFace.` + (errors.length > 0 ? ` Alguns erros ocorreram: ${errors.join(', ')}` : '');
    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO add-face-examples ---");
    console.error("Mensagem:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});