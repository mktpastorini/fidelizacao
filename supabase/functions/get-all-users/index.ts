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
    // 1. Autenticação do Superadmin (via token)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Usuário não autenticado.");

    // 2. Verificar se o usuário é Superadmin (usando o cliente admin para ler o perfil)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas Superadmins podem listar todos os usuários." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 3. Buscar todos os usuários auth (incluindo emails)
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    // 4. Buscar todos os perfis
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, first_name, last_name');
    if (profilesError) throw profilesError;

    const profileMap = new Map(profiles.map(p => [p.id, p]));

    // 5. Combinar dados
    const combinedUsers = authUsers.users.map(authUser => {
      const profile = profileMap.get(authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        role: profile?.role || 'garcom', // Fallback role
        first_name: profile?.first_name || authUser.user_metadata.first_name || null,
        last_name: profile?.last_name || authUser.user_metadata.last_name || null,
      };
    });

    return new Response(JSON.stringify({ success: true, users: combinedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função get-all-users:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});