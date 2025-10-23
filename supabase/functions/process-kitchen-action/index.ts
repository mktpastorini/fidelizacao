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
    if (!itemId || !newStatus) {
      throw new Error("`itemId` e `newStatus` são obrigatórios.");
    }
    
    // 1. Buscar o item atual para verificar se requer preparo
    const { data: item, error: itemError } = await supabaseAdmin
        .from('itens_pedido')
        .select('status, cozinheiro_id, pedido:pedidos(mesa_id), requer_preparo')
        .eq('id', itemId)
        .single();
        
    if (itemError || !item) {
        throw new Error("Item de pedido não encontrado.");
    }
    
    const currentStatus = item.status;
    const currentCookId = item.cozinheiro_id;
    
    let recognizedCookId: string | null = null;
    let cookName: string = "Garçom/Balcão";

    // --- FLUXO 1: Item SEM PREPARO (Ação direta do Garçom/Balcão) ---
    if (!item.requer_preparo && newStatus === 'entregue' && image_url === 'dummy') {
        // Esta é a ação de entrega de item sem preparo (Garçom/Balcão)
        if (currentStatus !== 'pendente') {
            throw new Error(`Transição inválida: Item sem preparo deve estar 'pendente' para ser entregue.`);
        }
        
        // Atualiza status para 'entregue' (cozinheiro_id permanece NULL)
        const { error: updateError } = await supabaseAdmin
            .from('itens_pedido')
            .update({ status: 'entregue', updated_at: new Date().toISOString() })
            .eq('id', itemId);
        if (updateError) throw updateError;
        
        return new Response(JSON.stringify({ success: true, message: `Item sem preparo entregue ao cliente.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    
    // --- FLUXO 2: Item COM PREPARO (Requer reconhecimento facial) ---
    if (!image_url || image_url === 'dummy') {
        throw new Error("Ação de preparo/finalização requer reconhecimento facial. Imagem ausente.");
    }
    
    // 1a. Buscar configurações do CompreFace do Superadmin
    const { settings, error: settingsError } = await getComprefaceSettings(supabaseAdmin);
    if (settingsError) throw settingsError;

    // 1b. Reconhecimento Facial do Cozinheiro
    const recognitionResponse = await fetch(`${settings.compreface_url}/api/v1/recognition/recognize?limit=1`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.compreface_api_key,
        },
        body: JSON.stringify({ file: image_url.startsWith('data:image') ? image_url.split(',')[1] : image_url }),
    });
    
    const recognitionData = await recognitionResponse.json();
    const bestMatch = recognitionData.result?.[0]?.subjects?.[0];
    
    if (!recognitionResponse.ok || !bestMatch || bestMatch.similarity < 0.85) {
        throw new Error(recognitionData.error || "Cozinheiro não reconhecido ou similaridade insuficiente. Tente novamente.");
    }
    
    recognizedCookId = bestMatch.subject;
    
    // 1c. Verificar se o ID reconhecido é um Cozinheiro válido
    const { data: cook, error: cookError } = await supabaseAdmin
        .from('cozinheiros')
        .select('id, nome')
        .eq('id', recognizedCookId)
        .single();
        
    if (cookError || !cook) {
        throw new Error("ID reconhecido não corresponde a um cozinheiro cadastrado.");
    }
    cookName = cook.nome;


    // 4. Lógica de Transição (Item COM PREPARO)
    if (newStatus === 'preparando' && currentStatus === 'pendente') {
        // Ação: Iniciar Preparo
        
        if (!item.requer_preparo) {
            throw new Error("Este item não requer preparo na cozinha.");
        }
        
        // Atualiza status, cozinheiro_id e updated_at
        const { error: updateError } = await supabaseAdmin
            .from('itens_pedido')
            .update({ status: 'preparando', cozinheiro_id: recognizedCookId, updated_at: new Date().toISOString() })
            .eq('id', itemId);
        if (updateError) throw updateError;
        
        return new Response(JSON.stringify({ success: true, message: `Preparo iniciado por ${cookName}.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } 
    
    else if (newStatus === 'entregue' && currentStatus === 'preparando') {
        // Ação: Finalizar Preparo
        
        // Regra: Apenas o cozinheiro que iniciou pode finalizar
        if (currentCookId !== recognizedCookId) {
            throw new Error(`Apenas ${cookName} (o cozinheiro que iniciou o preparo) pode finalizar este item.`);
        }
        
        // Atualiza status
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});