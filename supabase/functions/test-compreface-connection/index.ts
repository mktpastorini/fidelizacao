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
    // 1. Autenticação do usuário
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

    // 2. Busca as configurações do usuário no banco de dados
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('compreface_url, compreface_api_key')
      .eq('id', user.id)
      .single();

    // 3. Valida se as configurações foram encontradas e estão completas
    if (settingsError) {
      console.error("Erro ao buscar configurações do usuário:", settingsError.message);
      throw new Error("Não foi possível recuperar as configurações. Por favor, salve a URL e a Chave de API primeiro.");
    }
    if (!settings?.compreface_url) {
      throw new Error("URL do CompreFace não configurada. Por favor, preencha o campo 'URL do Servidor CompreFace'.");
    }
    if (!settings?.compreface_api_key) {
      throw new Error("Chave de API do CompreFace não configurada. Por favor, preencha o campo 'Chave de API de Reconhecimento'.");
    }

    // 4. Tenta se comunicar com o CompreFace
    console.log(`Tentando conectar a ${settings.compreface_url}/api/v1/recognition/subjects`);
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/subjects`, {
      method: 'GET',
      headers: { 
        'x-api-key': settings.compreface_api_key,
        // Adiciona um User-Agent para evitar problemas com alguns firewalls
        'User-Agent': 'Fidelize-App/1.0'
      },
    });

    // 5. Trata a resposta do CompreFace
    if (!response.ok) {
      let errorMsg = `Falha na conexão com o servidor CompreFace. Status: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMsg += `. Detalhes: ${errorBody.message || JSON.stringify(errorBody)}`;
      } catch (e) {
        errorMsg += `. Detalhes: ${await response.text()}`;
      }
      console.error("Erro da API do CompreFace:", errorMsg);
      throw new Error(errorMsg);
    }

    // 6. Se chegou aqui, a conexão foi bem-sucedida
    console.log("Conexão com o CompreFace bem-sucedida!");
    return new Response(JSON.stringify({ success: true, message: "Conexão bem-sucedida com o servidor CompreFace!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO test-compreface-connection ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Retornamos 500 para o frontend saber que houve um erro no servidor
    });
  }
});