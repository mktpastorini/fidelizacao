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
    console.log("--- REGISTER-FACE: INICIANDO ---");
    const { cliente_id, image_url } = await req.json();
    if (!cliente_id || !image_url) {
      throw new Error("Payload inválido: cliente_id e image_url são obrigatórios.");
    }
    console.log(`REGISTER-FACE: 1/7 - Payload recebido para cliente ${cliente_id}.`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log("REGISTER-FACE: 2/7 - Cliente Supabase Admin criado.");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Cabeçalho de autorização não encontrado.");
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError) throw userError;
    if (!user) throw new Error("Usuário não autenticado.");
    console.log(`REGISTER-FACE: 3/7 - Usuário autenticado: ${user.id}`);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('ai_provider')
      .eq('id', user.id)
      .single();
    
    if (settingsError) throw settingsError;
    const provider = settings?.ai_provider || 'simulacao';
    console.log(`REGISTER-FACE: 4/7 - Provedor de IA: ${provider}`);

    let embedding;
    if (provider === 'google_vision') {
      console.log("REGISTER-FACE: 5/7 - Gerando embedding com Google Vision...");
      embedding = await getGoogleVisionEmbedding(image_url);
      console.log("REGISTER-FACE: 6/7 - Embedding do Google Vision gerado.");
    } else {
      console.log("REGISTER-FACE: 5/7 - Gerando embedding com Simulação...");
      embedding = getSimulatedEmbedding();
      console.log("REGISTER-FACE: 6/7 - Embedding de simulação gerado.");
    }

    const { error: upsertError } = await supabaseAdmin
      .from('customer_faces')
      .upsert({
        cliente_id: cliente_id,
        user_id: user.id,
        embedding: embedding,
        ai_provider: provider,
      }, { onConflict: 'cliente_id' });

    if (upsertError) throw upsertError;
    console.log("REGISTER-FACE: 7/7 - Embedding salvo no DB. SUCESSO.");

    return new Response(JSON.stringify({ success: true, message: `Rosto cadastrado com sucesso usando ${provider}.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("--- ERRO NA FUNÇÃO REGISTER-FACE ---");
    console.error(`MENSAGEM: ${error.message}`);
    console.error(`STACK: ${error.stack}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})