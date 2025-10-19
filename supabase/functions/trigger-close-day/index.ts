import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("=== INICIANDO FUNÇÃO trigger-close-day ===");
    
    // 1. Verificar chave de API no cabeçalho
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Chave de API não fornecida ou inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Verificar se a chave de API é válida e buscar configurações
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('id, auto_close_enabled, auto_close_time, establishment_is_closed')
      .eq('api_key', apiKey)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: 'Chave de API inválida ou configurações não encontradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = settings.id;
    
    // 3. Verificar se o fechamento automático está habilitado
    if (!settings.auto_close_enabled) {
      return new Response(JSON.stringify({ success: true, message: "Fechamento automático desabilitado nas configurações." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // 4. Verificar se o estabelecimento já está fechado
    if (settings.establishment_is_closed) {
      return new Response(JSON.stringify({ success: true, message: "Estabelecimento já está fechado." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // 5. Verificar se é o horário correto (usando a hora de Brasília)
    const nowBrazil = getBrazilTime();
    const currentTime = nowBrazil.toTimeString().substring(0, 5); // HH:MM
    const scheduledTime = settings.auto_close_time || "23:00";
    
    console.log(`Hora atual (BR): ${currentTime}, Hora agendada: ${scheduledTime}`);

    if (currentTime !== scheduledTime) {
      return new Response(JSON.stringify({ success: true, message: `Ainda não é o horário agendado (${scheduledTime}).` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      });
    }

    // 6. Chamar a função close-day (que contém a lógica de fechamento e envio de relatório)
    console.log("Horário de fechamento atingido. Disparando função close-day...");
    
    // Usamos o invoke para chamar a função close-day, passando o token de serviço para autenticação interna
    const { data: closeDayData, error: closeDayError } = await supabaseAdmin.functions.invoke('close-day', {
        headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: { userId: userId } // Passando o userId para a função close-day
    });

    if (closeDayError) {
        throw new Error(`Falha ao executar close-day: ${closeDayError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: closeDayData.message || "Fechamento do dia acionado com sucesso." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro ao acionar fechamento do dia:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});