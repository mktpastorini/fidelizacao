import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TABLES_TO_EXPORT = [
  'categorias', 'produtos', 'clientes', 'filhos', 'mesas', 'pedidos', 
  'itens_pedido', 'mesa_ocupantes', 'cozinheiros', 'message_templates', 
  'message_logs', 'approval_requests', 'daily_visits'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Usuário não autenticado.");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'superadmin') {
      throw new Error("Apenas Super Admins podem exportar dados.");
    }

    const backupData: { [key: string]: any[] } = {};

    for (const table of TABLES_TO_EXPORT) {
      const { data, error } = await supabaseAdmin.from(table).select('*');
      if (error) throw new Error(`Erro ao exportar a tabela ${table}: ${error.message}`);
      backupData[table] = data || [];
    }

    return new Response(JSON.stringify(backupData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})