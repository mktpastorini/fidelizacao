import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const IFOOD_API_URL = 'https://merchant-api.ifood.com.br';

async function getIfoodApiToken(clientId: string, clientSecret: string): Promise<string> {
  console.log("iFood Ack: Obtendo token de autenticação...");
  const params = new URLSearchParams();
  params.append('grantType', 'client_credentials');
  params.append('clientId', clientId);
  params.append('clientSecret', clientSecret);

  const response = await fetch(`${IFOOD_API_URL}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => response.text());
    throw new Error(`Falha ao obter token do iFood. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
  }

  const data = await response.json();
  console.log("iFood Ack: Token obtido com sucesso.");
  return data.accessToken;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { events } = await req.json();
    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new Error("O corpo da requisição deve conter um array 'events'.");
    }

    const ifoodClientId = Deno.env.get('IFOOD_CLIENT_ID');
    const ifoodClientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');

    if (!ifoodClientId || !ifoodClientSecret) {
      throw new Error("Credenciais do iFood (IFOOD_CLIENT_ID, IFOOD_CLIENT_SECRET) não configuradas como secrets.");
    }

    const token = await getIfoodApiToken(ifoodClientId, ifoodClientSecret);

    console.log("iFood Ack: Enviando confirmação para a API do iFood...");
    const ackResponse = await fetch(`${IFOOD_API_URL}/order/v1.0/events/acknowledgment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(events),
    });

    if (!ackResponse.ok) {
      const errorBody = await ackResponse.text();
      throw new Error(`Falha ao enviar acknowledgment para o iFood. Status: ${ackResponse.status}. Detalhes: ${errorBody}`);
    }

    console.log("iFood Ack: Eventos confirmados com sucesso no iFood.");
    return new Response(null, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202, // 202 Accepted é a resposta esperada pelo iFood
    });

  } catch (error) {
    console.error("Erro na função ifood-acknowledgment:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});