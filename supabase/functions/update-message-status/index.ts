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
    const { log_id, status } = await req.json();
    if (!log_id || !status) {
      throw new Error("`log_id` e `status` são obrigatórios no corpo da requisição.");
    }

    const validStatuses = ['delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Status inválido. Use um dos seguintes: ${validStatuses.join(', ')}.`);
    }

    const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      throw new Error("Chave de API não fornecida no cabeçalho de autorização.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .eq('api_key', apiKey)
      .single();

    if (settingsError || !settings) {
      throw new Error("Chave de API inválida ou não encontrada.");
    }

    const { error: updateError } = await supabaseAdmin
      .from('message_logs')
      .update({ delivery_status: status })
      .eq('id', log_id)
      .eq('user_id', settings.id); // Garante que o usuário só pode atualizar seus próprios logs

    if (updateError) {
      throw new Error(`Erro ao atualizar o log: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Status do log ${log_id} atualizado para ${status}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})