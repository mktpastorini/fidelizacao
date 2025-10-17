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
    const { client_id, image_urls } = await req.json();
    if (!client_id || !image_urls || !Array.isArray(image_urls)) {
      throw new Error("`client_id` e um array de `image_urls` são obrigatórios.");
    }

    const userClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw userError || new Error("Usuário não autenticado.");

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: settings, error: settingsError } = await supabaseAdmin.from('user_settings').select('compreface_url, compreface_api_key').eq('id', user.id).single();
    if (settingsError || !settings?.compreface_url || !settings.compreface_api_key) {
      throw new Error('URL ou Chave de API do CompreFace não configuradas.');
    }

    for (const imageUrl of image_urls) {
      const response = await fetch(`${settings.compreface_url}/api/v1/recognition/faces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.compreface_api_key,
        },
        body: JSON.stringify({
          file: imageUrl,
          subject: client_id,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error(`Falha ao adicionar imagem para o cliente ${client_id}:`, errorBody);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `${image_urls.length} foto(s) enviada(s) para registro.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});