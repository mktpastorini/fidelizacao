import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
import { showError, showSuccess } from "@/utils/toast";
import { ApprovalActionType, UserRole } from "@/types/supabase";

type RequestPayload = {
  action_type: ApprovalActionType;
  target_id: string;
  payload: Record<string, any>;
};

export function useApprovalRequest() {
  const { userRole } = useSettings();
  const queryClient = useQueryClient();

  const createRequestMutation = useMutation({
    mutationFn: async (request: RequestPayload) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userRole) throw new Error("Usuário não autenticado.");

      const insertionPayload = {
        user_id: user.id,
        requester_role: userRole,
        action_type: request.action_type,
        target_id: request.target_id,
        payload: request.payload,
        status: 'pending',
      };
      
      console.log("[ApprovalRequest] Tentando inserir payload:", insertionPayload); // NOVO LOG AQUI

      const { error } = await supabase.from("approval_requests").insert(insertionPayload);
      if (error) {
        console.error("[ApprovalRequest] Erro ao inserir solicitação:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_approval_requests"] });
      showSuccess("Solicitação enviada para aprovação!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const executeActionDirectly = async (request: RequestPayload) => {
    // Esta função simula a execução direta da ação (para admins/gerentes)
    const { action_type, target_id, payload } = request;
    
    try {
        switch (action_type) {
            case 'free_table': {
                const mesaId = target_id;
                
                // 1. Tenta cancelar o pedido aberto (se existir)
                const { data: openOrder, error: findError } = await supabase.from('pedidos').select('id').eq('mesa_id', mesaId).eq('status', 'aberto').maybeSingle();
                if (findError && findError.code !== 'PGRST116') throw findError;

                let orderWasCancelled = false;
                if (openOrder) {
                    const { error: updateError } = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', openOrder.id);
                    if (updateError) throw updateError;
                    orderWasCancelled = true;
                }

                // 2. Libera a mesa e remove ocupantes
                await supabase.from("mesas").update({ cliente_id: null }).eq("id", mesaId);
                await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesaId);
                
                queryClient.invalidateQueries({ queryKey: ["mesas"] });
                queryClient.invalidateQueries({ queryKey: ["salaoData"] });
                queryClient.invalidateQueries({ queryKey: ["clientes"] });
                
                if (orderWasCancelled) {
                    showSuccess("Mesa liberada e pedido cancelado!");
                } else {
                    showSuccess("Mesa liberada!");
                }
                break;
            }
            case 'apply_discount': {
                const itemId = target_id;
                const { desconto_percentual, desconto_motivo } = payload;
                
                const { error: updateError } = await supabase.from("itens_pedido").update({ desconto_percentual, desconto_motivo }).eq("id", itemId);
                if (updateError) throw updateError;
                
                queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
                queryClient.invalidateQueries({ queryKey: ["salaoData"] });
                queryClient.invalidateQueries({ queryKey: ["mesas"] });
                
                showSuccess("Desconto aplicado com sucesso!");
                break;
            }
            default:
                throw new Error("Ação desconhecida.");
        }
        return true;
    } catch (error: any) {
        showError(`Falha ao executar ação: ${error.message}`);
        return false;
    }
  };

  const requestApproval = async (request: RequestPayload) => {
    if (!userRole) {
        showError("Aguarde, a função do usuário ainda está sendo carregada.");
        return false;
    }
    
    const rolesThatRequireApproval: UserRole[] = ['balcao', 'garcom', 'cozinha'];
    
    console.log(`[ApprovalCheck] Usuário: ${userRole}. Requer aprovação? ${rolesThatRequireApproval.includes(userRole)}`);

    if (rolesThatRequireApproval.includes(userRole)) {
      // Se for um usuário que precisa de aprovação, cria a solicitação
      createRequestMutation.mutate(request);
      return false; // Indica que a ação não foi executada diretamente
    } else {
      // Se for Admin/Gerente/Superadmin, executa a ação diretamente
      return executeActionDirectly(request);
    }
  };

  return {
    requestApproval,
    isRequesting: createRequestMutation.isPending,
  };
}