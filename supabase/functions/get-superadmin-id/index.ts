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
    // 1. Autenticação do usuário logado (apenas para garantir que a requisição é de um usuário válido)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");

    // 2. Buscar o ID do Superadmin
    const { data: superadminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1)
      .maybeSingle();

    if (profileError || !superadminProfile) {
      throw new Error("Falha ao encontrar o Superadmin principal.");
    }
    
    return new Response(JSON.stringify({ success: true, superadmin_id: superadminProfile.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função get-superadmin-id:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});