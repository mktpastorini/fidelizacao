import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettings(supabaseAdmin: any) {
  // 1. Buscar o ID do Superadmin
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    return { settings: null, error: new Error("Falha ao encontrar o Superadmin principal.") };
  }
  
  const superadminId = superadminProfile.id;

  // 2. Buscar as configurações do Superadmin
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError) {
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema.") };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin. Por favor, configure em 'Configurações' > 'Reconhecimento Facial'.") };
  }

  return { settings, error: null, superadminId };
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
    const { image_url } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }
    
    // 2. Buscando configurações do CompreFace do Superadmin
    const { settings, error: settingsError, superadminId } = await getComprefaceSettings(supabaseAdmin);

    if (settingsError) {
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const payload = { file: imageData };
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize?limit=0`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => response.text());
      if (response.status === 400 && typeof errorBody === 'object' && errorBody.code === 28) {
        return new Response(JSON.stringify({ matches: [], message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      
      const errorDetail = typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody);
      
      return new Response(JSON.stringify({ error: `Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${errorDetail}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const data = await response.json();
    const recognizedFaces = [];
    const minSimilarity = 0.85;

    if (data.result && Array.isArray(data.result)) {
      for (const faceResult of data.result) {
        const bestSubject = faceResult.subjects?.[0];
        if (bestSubject && bestSubject.similarity >= minSimilarity) {
          // Buscar dados do cliente usando o ID do Superadmin
          const { data: client, error: clientError } = await supabaseAdmin
            .from('clientes')
            .select('id, nome, avatar_url, gostos, casado_com, visitas')
            .eq('id', bestSubject.subject)
            .eq('user_id', superadminId)
            .single();

          if (clientError) {
            // Se o cliente não for encontrado, apenas ignora este match
            continue;
          }

          recognizedFaces.push({
            client: client,
            similarity: bestSubject.similarity,
            box: faceResult.box,
          });
        }
      }
    }

    return new Response(JSON.stringify({ matches: recognizedFaces }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${errorMessage}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});