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
    const { request_id, action } = await req.json();
    if (!request_id || !action) {
      throw new Error("`request_id` e `action` (approve/reject) são obrigatórios.");
    }

    // 1. Autenticação do Aprovador (via token)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Usuário não autenticado.");

    // 2. Buscar a solicitação pendente
    const { data: request, error: requestError } = await supabaseAdmin
      .from('approval_requests')
      .select('id, action_type, target_id, payload, status')
      .eq('id', request_id)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      throw new Error("Solicitação não encontrada ou já processada.");
    }

    // 3. Verificar a função do aprovador (apenas superadmin, admin, gerente podem aprovar)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !['superadmin', 'admin', 'gerente'].includes(profile?.role)) {
      return new Response(JSON.stringify({ error: "Acesso negado. Sua função não permite aprovar solicitações." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    let message = `Solicitação ${newStatus}.`;

    // 4. Se aprovado, executar a ação
    if (newStatus === 'approved') {
      switch (request.action_type) {
        case 'free_table': {
          // Chama a função RPC que já contém a lógica de verificação de preparo, cancelamento de itens pendentes do cliente principal e liberação da mesa.
          const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('process_free_table_request', {
            p_request_id: request_id,
            p_approved_by: user.id,
          });
          
          if (rpcError) {
            // Se a função SQL levantar uma exceção (ex: itens em preparo), o erro é capturado aqui.
            throw new Error(rpcError.message);
          }
          
          message = rpcResult.message || `Mesa ${request.payload.mesa_numero} liberada.`;
          
          // O RPC já atualizou o status da solicitação para 'approved' e o payload com detalhes do cancelamento.
          // Pulamos a atualização de status no passo 5 para esta ação.
          return new Response(JSON.stringify({ success: true, message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
        case 'apply_discount': {
          const itemId = request.target_id;
          const { desconto_percentual, desconto_motivo } = request.payload;
          
          const { error: updateError } = await supabaseAdmin
            .from("itens_pedido")
            .update({ desconto_percentual, desconto_motivo })
            .eq("id", itemId);
          
          if (updateError) throw updateError;
          message = `Desconto de ${desconto_percentual}% aplicado ao item.`;
          break;
        }
        default:
          throw new Error(`Tipo de ação desconhecido: ${request.action_type}`);
      }
    }

    // 5. Atualizar o status da solicitação (Apenas para ações que não usam process_free_table_request)
    const { error: updateError } = await supabaseAdmin
      .from('approval_requests')
      .update({ 
        status: newStatus, 
        approved_by: user.id, 
        approved_at: new Date().toISOString() 
      })
      .eq('id', request_id);

    if (updateError) {
      console.error("Erro ao atualizar status da solicitação:", updateError);
      throw new Error("Ação executada, mas falha ao registrar o status. Contate o suporte.");
    }

    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função process-approval-request:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});