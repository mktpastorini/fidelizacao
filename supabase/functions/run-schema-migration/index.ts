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
    const { schema_sql, install_password } = await req.json();
    
    // 1. Verificar a senha de instalação (usando uma variável de ambiente para segurança)
    const expectedPassword = Deno.env.get('INSTALL_PASSWORD');
    if (!expectedPassword || install_password !== expectedPassword) {
        return new Response(JSON.stringify({ error: "Senha de instalação inválida." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
        });
    }

    if (!schema_sql) {
      throw new Error("O script SQL do esquema é obrigatório.");
    }

    console.log("--- INICIANDO EXECUÇÃO DO SCHEMA SQL ---");
    
    // 2. Executar o script SQL
    const { error: sqlError } = await supabaseAdmin.rpc('execute_sql', { sql: schema_sql });

    if (sqlError) {
      console.error("Erro ao executar SQL:", sqlError);
      throw new Error(`Erro ao aplicar o esquema: ${sqlError.message}`);
    }

    console.log("--- EXECUÇÃO DO SCHEMA SQL CONCLUÍDA COM SUCESSO ---");

    return new Response(JSON.stringify({ success: true, message: "Esquema do banco de dados aplicado com sucesso!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função run-schema-migration:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});