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

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // 1. Authenticate via API Key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Chave de API não fornecida ou inválida.');
    }
    const apiKey = authHeader.substring(7);

    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('id')
      .eq('api_key', apiKey)
      .single();

    if (settingsError || !userSettings) {
      throw new Error('Chave de API inválida.');
    }
    const userId = userSettings.id;

    // 2. Fetch products
    const { data: produtos, error: productsError } = await supabaseAdmin
      .from('produtos')
      .select('id, nome, preco, descricao, tipo, requer_preparo, estoque_atual, mostrar_no_menu')
      .eq('user_id', userId)
      .order('nome');
      
    if (productsError) throw productsError;

    // 3. Return products
    return new Response(JSON.stringify({ success: true, products: produtos }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função list-products:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});