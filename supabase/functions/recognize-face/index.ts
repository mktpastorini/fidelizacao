import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getGoogleVisionEmbedding } from '../_shared/google-vision-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getSimulatedEmbedding() {
  return Array(512).fill(0).map(() => Math.random() * 0.1);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("--- RECOGNIZE-FACE: INICIANDO ---");

    const { image_url } = await req.json();
    if (!image_url) {
      throw new Error("Payload inválido: image_url é obrigatório.");
    }
    console.log("RECOGNIZE-FACE: 1/10 - Payload recebido.");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log("RECOGNIZE-FACE: 2/10 - Cliente Supabase Admin criado.");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não encontrado.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não autenticado.");
    console.log(`RECOGNIZE-FACE: 3/10 - Usuário autenticado: ${user.id}`);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('ai_provider')
      .eq('id', user.id)
      .single();
    
    if (settingsError) throw settingsError;
    const provider = settings?.ai_provider || 'simulacao';
    console.log(`RECOGNIZE-FACE: 4/10 - Provedor de IA: ${provider}`);

    let embedding;
    if (provider === 'google_vision') {
      console.log("RECOGNIZE-FACE: 5/10 - Gerando embedding com Google Vision...");
      embedding = await getGoogleVisionEmbedding(image_url);
      console.log("RECOGNIZE-FACE: 6/10 - Embedding do Google Vision gerado.");
    } else {
      console.log("RECOGNIZE-FACE: 5/10 - Gerando embedding com Simulação...");
      embedding = getSimulatedEmbedding();
      console.log("RECOGNIZE-FACE: 6/10 - Embedding de simulação gerado.");
    }

    console.log("RECOGNIZE-FACE: 7/10 - Buscando correspondência no DB...");
    const { data: match, error: rpcError } = await supabaseAdmin.rpc('match_customer_face', {
      query_embedding: embedding,
      match_threshold: 0.9,
      match_count: 1,
      provider: provider,
    });

    if (rpcError) throw rpcError;
    console.log("RECOGNIZE-FACE: 8/10 - Busca no DB concluída.");

    if (!match || match.length === 0) {
      console.log("RECOGNIZE-FACE: 9/10 - Nenhuma correspondência encontrada.");
      return new Response(JSON.stringify({ match: null, message: 'Nenhum cliente correspondente encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`RECOGNIZE-FACE: 9/10 - Correspondência encontrada: cliente_id ${match[0].cliente_id}`);
    const { data: cliente, error: clientError } = await supabaseAdmin
      .from('clientes')
      .select('*, filhos(*)')
      .eq('id', match[0].cliente_id)
      .single();

    if (clientError) throw clientError;
    console.log("RECOGNIZE-FACE: 10/10 - Detalhes do cliente buscados. SUCESSO.");

    return new Response(JSON.stringify({ match: cliente }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO RECOGNIZE-FACE ---");
    console.error(`MENSAGEM: ${error.message}`);
    console.error(`STACK: ${error.stack}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})