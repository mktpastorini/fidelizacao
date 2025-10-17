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
    const { image_url } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");

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

    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
        'User-Agent': 'Fidelize-App/1.0'
      },
      body: JSON.stringify({ file: image_url }),
    });

    if (!response.ok) {
      let errorMsg = `Erro ao chamar a API do CompreFace para reconhecimento. Status: ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMsg += `. Detalhes: ${errorBody.message || JSON.stringify(errorBody)}`;
      } catch (e) {
        errorMsg += `. Detalhes: ${await response.text()}`;
      }
      console.error("Erro da API do CompreFace (reconhecimento):", errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const bestMatch = data.result?.[0]?.subjects?.[0];

    if (bestMatch && bestMatch.similarity >= 0.90) {
      const { data: client, error: clientError } = await supabaseAdmin
        .from('clientes')
        .select('*, filhos(*)')
        .eq('id', bestMatch.subject)
        .single();
      if (clientError) {
          console.error("Erro ao buscar cliente no banco:", clientError.message);
          throw new Error(`Cliente encontrado pelo CompreFace, mas erro ao recuperar dados: ${clientError.message}`);
      }
      return new Response(JSON.stringify({ match: client, distance: 1 - bestMatch.similarity }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    return new Response(JSON.stringify({ match: null, distance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO recognize-face-compreface ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});