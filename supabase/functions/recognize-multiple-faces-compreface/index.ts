import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettingsAndSuperadminId(supabaseAdmin: any) {
  console.log("[RF-MULTI] Buscando configurações do CompreFace do Superadmin principal...");

  // 1. Buscar o ID do Superadmin
  const { data: superadminProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .maybeSingle();

  if (profileError || !superadminProfile) {
    console.error("[RF-MULTI] Erro ao buscar Superadmin:", profileError);
    return { settings: null, error: new Error("Falha ao encontrar o Superadmin principal."), superadminId: null };
  }
  
  const superadminId = superadminProfile.id;
  console.log(`[RF-MULTI] Superadmin ID encontrado: ${superadminId}`);

  // 2. Buscar as configurações do Superadmin
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError) {
    console.error(`[RF-MULTI] Erro ao buscar configurações do Superadmin ${superadminId}:`, settingsError);
    return { settings: null, error: new Error("Falha ao carregar configurações do sistema."), superadminId };
  }

  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin. Por favor, configure em 'Configurações' > 'Reconhecimento Facial'."), superadminId };
  }

  return { settings, error: null, superadminId };
}

serve(async (req) => {
  console.log("--- [RF-MULTI] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[RF-MULTI] 1/7: Parsing body da requisição...");
    const { image_url, min_similarity } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log("[RF-MULTI] 1/7: Body recebido.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    console.log("[RF-MULTI] 2/7: Autenticando usuário logado...");
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado. O reconhecimento de múltiplos rostos requer autenticação.");
    }
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");
    console.log(`[RF-MULTI] 2/7: Usuário autenticado: ${user.id}`);
    
    console.log("[RF-MULTI] 3/7: Buscando configurações do CompreFace e ID do Super Admin...");
    const { settings, error: settingsError, superadminId } = await getComprefaceSettingsAndSuperadminId(supabaseAdmin);

    if (settingsError) {
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!superadminId) throw new Error("ID do Superadmin não encontrado.");
    console.log(`[RF-MULTI] 3/7: Configurações carregadas. ID do Super Admin para clientes: ${superadminId}`);

    const payload = { file: imageData };
    console.log("[RF-MULTI] 4/7: Enviando para CompreFace para reconhecimento de múltiplas faces...");
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize?limit=0`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[RF-MULTI] 5/7: Resposta recebida do CompreFace com status: ${response.status}`);
    const responseBody = await response.json().catch(() => response.text());
    console.log(`[RF-MULTI] 5/7: Corpo da resposta do CompreFace:`, responseBody);

    if (!response.ok) {
      if (response.status === 400 && typeof responseBody === 'object' && responseBody.code === 28) {
        console.log("[RF-MULTI] CompreFace não encontrou nenhum rosto na imagem.");
        return new Response(JSON.stringify({ matches: [], message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(responseBody)}`);
    }

    const recognizedFaces = [];
    const minSimilarity = min_similarity ?? 0.85;

    if (responseBody.result && Array.isArray(responseBody.result)) {
      console.log(`[RF-MULTI] 6/7: Processando ${responseBody.result.length} rosto(s) detectado(s)...`);
      for (const faceResult of responseBody.result) {
        const bestSubject = faceResult.subjects?.[0];
        if (bestSubject && bestSubject.similarity >= minSimilarity) {
          console.log(`[RF-MULTI]   - Match encontrado: Subject ${bestSubject.subject}, Similaridade ${bestSubject.similarity}`);

          const { data: client, error: clientError } = await supabaseAdmin
            .from('clientes')
            .select('*, filhos(*)')
            .eq('id', bestSubject.subject)
            .single();

          if (clientError) {
            console.error(`[RF-MULTI]   - Erro ao buscar cliente ${bestSubject.subject} no DB: ${clientError.message}`);
            continue; // Pula para o próximo rosto
          }

          console.log(`[RF-MULTI]   - Cliente ${client.nome} encontrado no DB.`);
          recognizedFaces.push({
            client: client,
            similarity: bestSubject.similarity,
            box: faceResult.box,
          });
        } else {
          console.log(`[RF-MULTI]   - Rosto detectado sem match válido (similaridade abaixo de ${minSimilarity}).`);
        }
      }
    }

    console.log(`[RF-MULTI] 7/7: Processamento concluído. ${recognizedFaces.length} cliente(s) reconhecido(s).`);
    return new Response(JSON.stringify({ matches: recognizedFaces }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- [RF-MULTI] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});