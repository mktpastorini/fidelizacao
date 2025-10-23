import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    
    // 1. Reconhecimento Facial do Cozinheiro
    const recognitionResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/recognize-cook-face`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization')!, // Passa o token do usuário logado
        },
        body: JSON.stringify({ image_url }),
    });
    
    const recognitionData = await recognitionResponse.json();
    if (!recognitionResponse.ok || !recognitionData.match) {
        throw new Error(recognitionData.error || "Cozinheiro não reconhecido ou falha no serviço de reconhecimento.");
    }
    
    const recognizedCookId = recognitionData.match.id;
    const cookName = recognitionData.match.nome;

    // 2. Buscar o item atual
    const { data: item, error: itemError } = await supabaseAdmin
        .from('itens_pedido')
        .select('status, cozinheiro_id, pedido_id, requer_preparo')
        .eq('id', itemId)
        .single();
        
    if (itemError || !item) {
        throw new Error("Item de pedido não encontrado.");
    }
    
    const currentStatus = item.status;
    const currentCookId = item.cozinheiro_id;
    const pedidoId = item.pedido_id;

    // 3. Lógica de Transição
    if (newStatus === 'preparando' && currentStatus === 'pendente') {
        // Ação: Iniciar Preparo
        
        // Verifica se o item requer preparo (Garçom/Balcão não deve iniciar preparo de itens sem preparo)
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