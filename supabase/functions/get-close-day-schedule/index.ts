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
    console.log("=== INICIANDO FUNÇÃO get-close-day-schedule ===");
    
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

    // 2. Verificar se a chave de API é válida e buscar o horário
    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('auto_close_time')
      .eq('api_key', apiKey)
      .single();

    if (settingsError || !userSettings) {
      return new Response(
        JSON.stringify({ error: 'Chave de API inválida ou configurações não encontradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { auto_close_time } = userSettings;
    console.log(`Horário de fechamento encontrado: ${auto_close_time}`);

    return new Response(JSON.stringify({ 
      success: true, 
      auto_close_time: auto_close_time || "23:00" // Padrão 23:00
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro ao obter horário de fechamento:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});