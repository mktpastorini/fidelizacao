import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function personalizeMessage(content: string, client: any): string {
  let personalized = content;
  const clientData = {
    nome: client.nome || '',
    conjuge: client.casado_com || '',
    indicacoes: client.indicacoes?.toString() || '0',
  };

  for (const [key, value] of Object.entries(clientData)) {
    personalized = personalized.replace(new RegExp(`{${key}}`, 'g'), value);
  }

  if (client.gostos && typeof client.gostos === 'object') {
    for (const [key, value] of Object.entries(client.gostos)) {
      personalized = personalized.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
  }

  personalized = personalized.replace(/{[a-zA-Z_]+}/g, '');
  return personalized;
}

// Função auxiliar para buscar o ID do Superadmin
async function getSuperadminId(supabaseAdmin: any) {
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    throw new Error("Falha ao encontrar o Superadmin principal.");
  }
  return superadminProfile.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const { pedidoId, userId } = await req.json()
  if (!pedidoId || !userId) {
    return new Response(JSON.stringify({ error: "pedidoId e userId são obrigatórios." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let logId: string | null = null;
  let clientId: string | null = null;
  let superadminId: string;

  try {
    // 1. Obter o ID do Superadmin
    superadminId = await getSuperadminId(supabaseAdmin);

    // 2. Buscar o cliente principal do pedido (o pedido pertence ao Superadmin)
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('cliente_id')
      .eq('id', pedidoId)
      .eq('user_id', superadminId)
      .single();
    
    if (pedidoError || !pedido?.cliente_id) {
        throw new Error('Cliente principal não encontrado para este pedido.');
    }
    clientId = pedido.cliente_id;

    // 3. Buscar configurações (webhook_url, template_id) usando o ID do Superadmin
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('webhook_url, pagamento_template_id')
      .eq('id', superadminId)
      .single()

    if (settingsError) throw settingsError
    if (!settings?.webhook_url || !settings?.pagamento_template_id) {
      throw new Error('Webhook ou template de pagamento não configurado no perfil do Superadmin.');
    }

    // 4. Criar log (associado ao Superadmin)
    const { data: initialLog, error: logError } = await supabaseAdmin
      .from('message_logs')
      .insert({
        user_id: superadminId, // Log associado ao Superadmin
        cliente_id: clientId,
        template_id: settings.pagamento_template_id,
        trigger_event: 'pagamento',
        status: 'processando',
      })
      .select('id')
      .single();

    if (logError) throw new Error(`Falha ao criar log inicial: ${logError.message}`);
    logId = initialLog.id;

    // 5. Buscar template (associado ao Superadmin)
    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('conteudo')
      .eq('id', settings.pagamento_template_id)
      .eq('user_id', superadminId)
      .single()
    if (templateError) throw templateError

    // 6. Buscar cliente (associado ao Superadmin)
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('nome, casado_com, indicacoes, gostos, whatsapp')
      .eq('id', clientId)
      .eq('user_id', superadminId)
      .single()
    if (clientError) throw clientError
    if (!client.whatsapp) {
      throw new Error('Cliente não possui número de WhatsApp.');
    }

    const personalizedMessage = personalizeMessage(template.conteudo, client);

    const webhookPayload = {
      recipients: [
        {
          log_id: logId,
          phone: client.whatsapp,
          message: personalizedMessage,
          client_name: client.nome,
          callback_endpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/update-message-status`,
        }
      ]
    };

    const webhookResponse = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    })

    const responseBody = await webhookResponse.json().catch(() => webhookResponse.text());

    if (!webhookResponse.ok) {
      throw new Error(`Webhook de pagamento falhou com status: ${webhookResponse.status}. Resposta: ${JSON.stringify(responseBody)}`);
    }

    await supabaseAdmin.from('message_logs').update({ status: 'sucesso', webhook_response: responseBody }).eq('id', logId);

    return new Response(JSON.stringify({ success: true, message: 'Webhook de pagamento enviado com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    if (logId) {
      await supabaseAdmin.from('message_logs').update({ status: 'falha', error_message: error.message }).eq('id', logId);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})