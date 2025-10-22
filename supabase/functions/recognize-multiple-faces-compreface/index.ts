import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do CompreFace
// Agora busca as configurações do Superadmin/Admin principal, ignorando o userId do chamador
async function getComprefaceSettings(supabaseAdmin: any) {
  console.log("[recognize-multiple-faces] Buscando configurações globais do CompreFace (Superadmin/Admin)...");
  
  // 1. Encontra o ID de um Superadmin ou Admin
  const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['superadmin', 'admin'])
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (adminProfileError || !adminProfile) {
    console.error("[recognize-multiple-faces] Nenhum Superadmin/Admin encontrado para configurações.");
    return { settings: null, error: new Error("Nenhum Superadmin ou Admin configurado no sistema.") };
  }

  // 2. Busca as configurações desse Admin
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', adminProfile.id)
    .maybeSingle();
    
  if (settingsError && settingsError.code !== 'PGRST116') {
    console.error("[recognize-multiple-faces] Erro ao buscar configurações do Admin:", settingsError);
    return { settings: null, error: new Error("Falha ao carregar configurações de sistema.") };
  }
  
  if (!settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Administrador.") };
  }

  return { settings, error: null };
}

serve(async (req) => {
  console.log("--- [recognize-multiple-faces] INICIANDO EXECUÇÃO ---");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[recognize-multiple-faces] 1/6: Parsing body da requisição...");
    const { image_url } = await req.json();
    if (!image_url) throw new Error("`image_url` é obrigatório.");
    console.log("[recognize-multiple-faces] 1/6: Body recebido.");

    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    // 2. Determinar o ID do usuário (dono do estabelecimento)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      // Tenta validar o token do usuário logado (Painel Admin/Garçom)
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      
      if (user && !userError) {
        userId = user.id;
        console.log(`[recognize-multiple-faces] 2/6: Usuário autenticado: ${userId}`);
      } else {
        throw new Error(`Falha na autenticação do usuário: ${userError?.message || "Usuário não encontrado."}`);
      }
    } else {
      throw new Error("Usuário não autenticado. O reconhecimento de múltiplos rostos requer autenticação.");
    }

    // 3. Buscando configurações do CompreFace (AGORA IGNORA userId)
    console.log("[recognize-multiple-faces] 3/6: Buscando configurações do CompreFace...");
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin);

    if (settingsError) {
      // Se houver erro na busca de configurações, retorna 400 para o frontend
      return new Response(JSON.stringify({ error: settingsError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    console.log("[recognize-multiple-faces] 3/6: Configurações carregadas.");

    const payload = { file: imageData };
    console.log("[recognize-multiple-faces] 4/6: Enviando para CompreFace para reconhecimento de múltiplas faces...");
    // Usar limit=0 para obter todos os rostos detectados
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize?limit=0`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.compreface_api_key,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[recognize-multiple-faces] 5/6: Resposta recebida do CompreFace com status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => response.text());
      if (response.status === 400 && typeof errorBody === 'object' && errorBody.code === 28) {
        console.log("[recognize-multiple-faces] CompreFace não encontrou nenhum rosto na imagem.");
        return new Response(JSON.stringify({ matches: [], message: "Nenhum rosto detectado na imagem." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    const recognizedFaces = [];
    const minSimilarity = 0.85; // Limiar de similaridade para considerar um match

    if (data.result && Array.isArray(data.result)) {
      for (const faceResult of data.result) {
        const bestSubject = faceResult.subjects?.[0];
        if (bestSubject && bestSubject.similarity >= minSimilarity) {
          console.log(`[recognize-multiple-faces] Match encontrado - Subject: ${bestSubject.subject}, Similaridade: ${bestSubject.similarity}`);
          
          // Buscar dados do cliente (USANDO SUPABASE ADMIN)
          const { data: client, error: clientError } = await supabaseAdmin
            .from('clientes')
            .select('id, nome, avatar_url, gostos, casado_com, visitas') // Selecionar informações adicionais
            .eq('id', bestSubject.subject)
            .eq('user_id', userId) // Adiciona filtro de segurança
            .single();

          if (clientError) {
            console.error(`Erro ao buscar dados do cliente ${bestSubject.subject}: ${clientError.message}`);
            continue; // Pular este rosto se não conseguir buscar o cliente
          }

          recognizedFaces.push({
            client: client,
            similarity: bestSubject.similarity,
            box: faceResult.box, // Incluir a caixa delimitadora
          });
        }
      }
    }

    console.log(`[recognize-multiple-faces] 6/6: ${recognizedFaces.length} cliente(s) reconhecido(s).`);
    return new Response(JSON.stringify({ matches: recognizedFaces }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("--- [recognize-multiple-faces] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    return new Response(JSON.stringify({ error: `Erro interno na função: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});