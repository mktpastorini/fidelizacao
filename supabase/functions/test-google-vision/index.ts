import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { getGoogleVisionEmbedding } from '../_shared/google-vision-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log("--- INICIANDO TESTE DE CONEXÃO GOOGLE VISION ---");
    
    const testImageUrl = "https://storage.googleapis.com/cloud-samples-data/vision/face/face_no_surprise.jpg";
    console.log("Enviando requisição para a API do Google Vision...");

    // Usamos a função compartilhada para gerar o embedding, o que implicitamente testa a autenticação.
    await getGoogleVisionEmbedding(testImageUrl);
    
    console.log("SUCESSO: Conexão com a Google Vision API funcionando perfeitamente!");
    return new Response(JSON.stringify({ success: true, message: "Conexão com a Google Vision API funcionando perfeitamente!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("ERRO CATCH FINAL:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})