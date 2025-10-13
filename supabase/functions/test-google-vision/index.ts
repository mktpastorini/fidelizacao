import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getGoogleAuthToken } from '../_shared/google-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const accessToken = await getGoogleAuthToken();
    const testImageUrl = "https://storage.googleapis.com/cloud-samples-data/vision/face/face_no_surprise.jpg";

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: testImageUrl } },
          features: [{ type: 'FACE_DETECTION' }],
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Erro da API do Google com status ${response.status}. Resposta: ${errorText}`;
      try {
        const errorBody = JSON.parse(errorText);
        if (errorBody.error && errorBody.error.message) {
          errorMessage = `Erro da API do Google: ${errorBody.error.message}`;
        }
      } catch (e) { /* O corpo não era JSON, usamos o texto bruto. */ }
      console.error("Google Vision API Error:", errorText);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const faceAnnotation = data.responses[0]?.faceAnnotations?.[0];

    if (!faceAnnotation) {
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