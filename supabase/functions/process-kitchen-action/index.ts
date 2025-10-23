import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para buscar as configurações do Superadmin
async function getComprefaceSettings(supabaseAdmin: any) {
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

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('user_settings')
    .select('compreface_url, compreface_api_key')
    .eq('id', superadminId)
    .single();

  if (settingsError || !settings?.compreface_url || !settings?.compreface_api_key) {
    return { settings: null, error: new Error("URL ou Chave de API do CompreFace não configuradas no perfil do Superadmin.") };
  }

  return { settings, error: null, superadminId };
}

// Função auxiliar para reconhecer o cozinheiro
async function recognizeCook(settings: any, image_url: string): Promise<{ cookId: string, similarity: number } | null> {
    let imageData = image_url;
    if (image_url.startsWith('data:image')) {
      imageData = image_url.split(',')[1];
    }

    const payload = { file: imageData };
    
    // Usamos o endpoint de reconhecimento, mas limitamos a busca aos subjects que são IDs de cozinheiros
    const response = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize?limit=1`, {
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
        return null; // Nenhum rosto detectado
      }
      throw new Error(`Erro na API do CompreFace. Status: ${response.status}. Detalhes: ${JSON.stringify(errorBody)}`);
    }

    const data = await response.json();
    const bestMatch = data.result?.[0]?.subjects?.[0];

    if (bestMatch && bestMatch.similarity >= 0.85) {
        // O subject é o ID do cozinheiro (UUID)
        return { cookId: bestMatch.subject, similarity: bestMatch.similarity };
    }
    return null;
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
    const { itemId, newStatus, image_url } = await req.json();
    if (!itemId || !newStatus || !image_url) {
      throw new Error("`itemId`, `newStatus` e `image_url` são obrigatórios.");
    }
    
    // 1. Autenticação do usuário logado (para obter o ID do estabelecimento)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Usuário não autenticado.");
    }
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error("Token de autenticação inválido ou expirado.");
    const userId = user.id;

    // 2. Buscar configurações do CompreFace do Superadmin
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin);
    if (settingsError) throw settingsError;

    // 3. Reconhecimento Facial do Cozinheiro
    const match = await recognizeCook(settings, image_url);
    if (!match) {
        throw new Error("Cozinheiro não reconhecido ou similaridade insuficiente. Tente novamente.");
    }
    const recognizedCookId = match.cookId;

    // 4. Verificar se o ID reconhecido é um Cozinheiro válido
    const { data: cook, error: cookError } = await supabaseAdmin
        .from('cozinheiros')
        .select('id, nome')
        .eq('id', recognizedCookId)
        .single();
        
    if (cookError || !cook) {
        throw new Error("ID reconhecido não corresponde a um cozinheiro cadastrado.");
    }
    const cookName = cook.nome;

    // 5. Buscar o item atual e verificar regras
    const { data: item, error: itemError } = await supabaseAdmin
        .from('itens_pedido')
        .select('status, cozinheiro_id, pedido:pedidos(mesa_id)')
        .eq('id', itemId)
        .single();
        
    if (itemError || !item) {
        throw new Error("Item de pedido não encontrado.");
    }
    
    const currentStatus = item.status;
    const currentCookId = item.cozinheiro_id;
    const mesaId = item.pedido?.mesa_id;

    // Regra 5a: Se for para 'preparando', o cozinheiro_id deve ser nulo
    if (newStatus === 'preparando' && currentStatus === 'pendente') {
        // OK. Atualiza status e cozinheiro_id
        const { error: updateError } = await supabaseAdmin
            .from('itens_pedido')
            .update({ status: 'preparando', cozinheiro_id: recognizedCookId, updated_at: new Date().toISOString() })
            .eq('id', itemId);
        if (updateError) throw updateError;
        
        // Regra 5b: Travar a mesa (impedir liberação) se o pedido for para 'preparando'
        if (mesaId) {
            // NOTA: Não há um campo 'travado' na tabela mesas. 
            // A regra de negócio será implementada no frontend/Edge Function de liberação de mesa.
            // A função 'process-approval-request' (free_table) precisará verificar se há itens 'preparando'.
        }
        
        return new Response(JSON.stringify({ success: true, message: `Preparo iniciado por ${cookName}.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } 
    
    // Regra 5c: Se for para 'entregue', o cozinheiro_id deve ser o mesmo
    else if (newStatus === 'entregue' && currentStatus === 'preparando') {
        if (currentCookId !== recognizedCookId) {
            throw new Error(`Apenas ${cookName} (o cozinheiro que iniciou o preparo) pode finalizar este item.`);
        }
        
        // OK. Atualiza status
        const { error: updateError } = await supabaseAdmin
            .from('itens_pedido')
            .update({ status: 'entregue', updated_at: new Date().toISOString() })
            .eq('id', itemId);
        if (updateError) throw updateError;
        
        return new Response(JSON.stringify({ success: true, message: `Item finalizado por ${cookName}.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    
    else {
        throw new Error(`Transição de status inválida: de ${currentStatus} para ${newStatus}.`);
    }

  } catch (error) {
    console.error("--- [process-kitchen-action] ERRO FATAL ---");
    console.error("Mensagem:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});