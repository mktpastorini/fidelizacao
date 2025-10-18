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
    const { subject, image_urls } = await req.json();
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      throw new Error(`Parâmetro 'subject' (ID do cliente) inválido ou ausente. Recebido: ${JSON.stringify(subject)}`);
    }
    if (!image_urls || !Array.isArray(image_urls)) {
      throw new Error("`image_urls` deve ser um array.");
    }

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
      console.error("Erro ao buscar configurações do usuário:", settingsError.message);
      throw new Error("Configurações do CompreFace não encontradas. Verifique a página de Configurações.");
    }
    if (!settings?.compreface_url || !settings?.compreface_api_key) {
      throw new Error("URL ou Chave de API do CompreFace não configuradas. Verifique a página de Configurações.");
    }

    let successCount = 0;
    let lastError = null;

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
          let errorMsg = `Falha ao enviar imagem para o CompreFace. Status: ${response.status}`;
          try {
            const errorBody = await response.json();
            errorMsg += `. Detalhes: ${errorBody.message || JSON.stringify(errorBody)}`;
          } catch (e) {
            errorMsg += `. Detalhes: ${await response.text()}`;
          }
          console.warn(`Erro ao enviar imagem ${imageUrl}:`, errorMsg);
          lastError = errorMsg; // Armazena o último erro, mas continua com as outras
        } else {
            successCount++;
        }
      } catch (fetchError) {
        console.warn(`Erro de rede ao enviar imagem ${imageUrl}:`, fetchError.message);
        lastError = `Erro de rede: ${fetchError.message}`;
      }
    }

    if (successCount === 0) {
        throw new Error(lastError || "Nenhuma imagem foi enviada com sucesso para o CompreFace.");
    }

    const message = `Enviadas ${successCount} de ${image_urls.length} foto(s) para o CompreFace.` + (lastError ? ` Erros: ${lastError}` : '');
    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO add-face-examples ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});