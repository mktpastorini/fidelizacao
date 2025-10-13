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
    const { clientId, userId } = await req.json()
    if (!clientId || !userId) {
      throw new Error("clientId e userId são obrigatórios.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, chegada_template_id')
      .eq('id', userId)
      .single()

    if (settingsError) throw settingsError
    if (!settings?.webhook_url || !settings?.chegada_template_id) {
      return new Response(JSON.stringify({ error: 'Webhook ou template de chegada não configurado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('conteudo')
      .eq('id', settings.chegada_template_id)
      .single()

    if (templateError) throw templateError

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('nome, whatsapp')
      .eq('id', clientId)
      .single()

    if (clientError) throw clientError
    if (!client.whatsapp) {
       return new Response(JSON.stringify({ error: 'Cliente não possui número de WhatsApp.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const personalizedMessage = template.conteudo.replace(/{cliente}/g, client.nome);

    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: client.whatsapp,
        message: personalizedMessage,
        client_name: client.nome,
      }),
    })

    if (!webhookResponse.ok) {
      const errorBody = await webhookResponse.text();
      throw new Error(`Webhook falhou com status: ${webhookResponse.status}. Resposta: ${errorBody}`)
    }

    return new Response(JSON.stringify({ success: true, message: 'Webhook enviado com sucesso.' }), {
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