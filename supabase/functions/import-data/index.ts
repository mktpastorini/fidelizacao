import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { decode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TABLES_WITH_IMAGES = {
  'clientes': { urlField: 'avatar_url', base64Field: 'avatar_base64', bucket: 'client_avatars' },
  'cozinheiros': { urlField: 'avatar_url', base64Field: 'avatar_base64', bucket: 'client_avatars' },
  'produtos': { urlField: 'imagem_url', base64Field: 'imagem_base64', bucket: 'client_avatars' }
};

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
      throw new Error("Apenas Super Admins podem importar dados.");
    }

    const backupData = await req.json();

    // Pré-processamento: Fazer upload de imagens base64 e substituir por URLs
    for (const tableName in TABLES_WITH_IMAGES) {
      if (backupData[tableName]) {
        const config = TABLES_WITH_IMAGES[tableName as keyof typeof TABLES_WITH_IMAGES];
        
        for (const row of backupData[tableName]) {
          if (row[config.base64Field]) {
            try {
              const imageBody = decode(row[config.base64Field]);
              const filePath = `public/${Date.now()}-${Math.random()}.jpg`;
              
              const { error: uploadError } = await supabaseAdmin.storage
                .from(config.bucket)
                .upload(filePath, imageBody, { contentType: 'image/jpeg' });

              if (uploadError) throw new Error(`Erro ao fazer upload da imagem para ${tableName}: ${uploadError.message}`);

              const { data: { publicUrl } } = supabaseAdmin.storage.from(config.bucket).getPublicUrl(filePath);
              
              row[config.urlField] = publicUrl;
              delete row[config.base64Field];

            } catch (e) {
              console.warn(`Falha ao processar imagem base64 para ${tableName}: ${e.message}`);
            }
          }
        }
      }
    }

    // Chamar a função SQL com os dados já processados
    const { error: rpcError } = await supabaseAdmin.rpc('import_backup_data', { backup_data: backupData });

    if (rpcError) {
      throw new Error(`Erro ao executar a importação no banco de dados: ${rpcError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Dados importados com sucesso! A página será recarregada." }), {
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