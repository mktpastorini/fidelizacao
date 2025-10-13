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
    // Cria um cliente Supabase com o token de autenticação do usuário
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Obtém o usuário a partir do token
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error("Usuário não encontrado.")

    // Cria um cliente admin para acessar as configurações do usuário de forma segura
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca a URL do webhook salva para o usuário
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url')
      .eq('id', user.id)
      .single()

    if (settingsError || !settings?.webhook_url) {
      return new Response(JSON.stringify({ message: 'Nenhuma URL de webhook salva. Salve uma URL antes de testar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Envia a requisição de teste para a URL salva
    const testPayload = {
      type: 'TEST_MESSAGE',
      message: 'Esta é uma mensagem de teste do Fidelize.',
      timestamp: new Date().toISOString(),
    };

    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })

    if (!webhookResponse.ok) {
      const errorBody = await webhookResponse.text();
      throw new Error(`O teste do webhook falhou com status: ${webhookResponse.status}. Resposta: ${errorBody}`)
    }

    const responseBody = await webhookResponse.json();

    return new Response(JSON.stringify({ success: true, message: 'Webhook testado com sucesso!', response: responseBody }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})