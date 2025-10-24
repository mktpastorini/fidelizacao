import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IFOOD_API_URL = 'https://merchant-api.ifood.com.br';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. Check for secrets
    const ifoodClientId = Deno.env.get('IFOOD_CLIENT_ID');
    const ifoodClientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
    const ifoodWebhookSecret = Deno.env.get('IFOOD_WEBHOOK_SECRET');

    if (!ifoodClientId || !ifoodClientSecret || !ifoodWebhookSecret) {
      throw new Error("Uma ou mais credenciais do iFood (IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET, IFOOD_WEBHOOK_SECRET) não estão configuradas como secrets no Supabase.");
    }

    // 2. Attempt to get an auth token from iFood
    const params = new URLSearchParams();
    params.append('grantType', 'client_credentials');
    params.append('clientId', ifoodClientId);
    params.append('clientSecret', ifoodClientSecret);

    const response = await fetch(`${IFOOD_API_URL}/authentication/v1.0/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => response.text());
      throw new Error(`Falha ao autenticar com o iFood. Verifique se o Client ID e Client Secret estão corretos. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
    }

    // 3. If successful, return success message
    return new Response(JSON.stringify({ success: true, message: "Conexão com a API do iFood bem-sucedida! As credenciais são válidas." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função test-ifood-integration:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});