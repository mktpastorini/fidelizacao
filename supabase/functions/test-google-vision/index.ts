import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
    if (!apiKey) {
      throw new Error("A variável de ambiente GOOGLE_VISION_API_KEY não está configurada no Supabase.");
    }

    // Usamos uma imagem de teste pública para verificar a API
    const testImageUrl = "https://storage.googleapis.com/cloud-samples-data/vision/face/face_no_surprise.jpg";

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: testImageUrl } },
          features: [{ type: 'FACE_DETECTION' }],
        }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Google Vision API Error:", errorBody);
      throw new Error(`Erro da API do Google: ${errorBody.error.message}`);
    }

    const data = await response.json();
    const faceAnnotation = data.responses[0]?.faceAnnotations?.[0];

    if (!faceAnnotation) {
      // Mesmo sem um rosto, uma resposta OK significa que a API está funcionando
      return new Response(JSON.stringify({ success: true, message: "Conexão bem-sucedida, mas nenhum rosto detectado na imagem de teste." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Conexão com a Google Vision API funcionando perfeitamente!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})