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
    const { action, email, password, first_name, last_name, user_id } = await req.json();
    
    // 1. Autenticação do Superadmin (via token)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Usuário não autenticado.");

    // 2. Verificar se o usuário é Superadmin
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
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas Superadmins podem gerenciar usuários." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 3. Executar a ação
    if (action === 'CREATE') {
      if (!email || !password) throw new Error("Email e senha são obrigatórios para criar um usuário.");

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

      if (createError) throw createError;
      
      // O trigger handle_new_user cuidará da criação do perfil e user_settings.
      return new Response(JSON.stringify({ success: true, message: "Usuário criado com sucesso.", userId: newUser.user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } 
    
    else if (action === 'DELETE') {
      if (!user_id) throw new Error("ID do usuário é obrigatório para deletar.");
      if (user_id === user.id) throw new Error("Você não pode deletar sua própria conta.");

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      
      if (deleteError) throw deleteError;
      
      // O CASCADE DELETE no perfil e user_settings deve cuidar do resto.
      return new Response(JSON.stringify({ success: true, message: "Usuário deletado com sucesso." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } 
    
    else {
      throw new Error("Ação inválida.");
    }

  } catch (error) {
    console.error("Erro na função manage-auth-user:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});