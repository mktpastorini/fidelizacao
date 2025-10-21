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
      .select('*')
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
          const mesaId = request.target_id;
          
          // Tenta cancelar o pedido aberto (se existir)
          const { data: openOrder, error: findError } = await supabaseAdmin.from('pedidos').select('id').eq('mesa_id', mesaId).eq('status', 'aberto').maybeSingle();
          if (findError && findError.code !== 'PGRST116') throw findError;

          if (openOrder) {
            const { error: updateError } = await supabaseAdmin.from('pedidos').update({ status: 'cancelado' }).eq('id', openOrder.id);
            if (updateError) throw updateError;
          }

          // Libera a mesa e remove ocupantes
          await supabaseAdmin.from("mesas").update({ cliente_id: null }).eq("id", mesaId);
          await supabaseAdmin.from("mesa_ocupantes").delete().eq("mesa_id", mesaId);
          message = `Mesa ${mesaId} liberada com sucesso.`;
          break;
        }
        case 'apply_discount': {
          const itemId = request.target_id;
          const { desconto_percentual, desconto_motivo } = request.payload;
          
          const { error: updateError } = await supabaseAdmin
            .from("itens_pedido")
            .update({ desconto_percentual, desconto_motivo })
            .eq("id", itemId);
          
          if (updateError) throw updateError;
          message = `Desconto de ${desconto_percentual}% aplicado ao item ${itemId}.`;
          break;
        }
        default:
          throw new Error(`Tipo de ação desconhecido: ${request.action_type}`);
      }
    }

    // 5. Atualizar o status da solicitação
    const { error: updateError } = await supabaseAdmin
      .from('approval_requests')
      .update({ 
        status: newStatus, 
        approved_by: user.id, 
        approved_at: new Date().toISOString() 
      })
      .eq('id', request_id);

    if (updateError) {
      // Se a atualização falhar, tentamos reverter a ação se ela foi executada
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