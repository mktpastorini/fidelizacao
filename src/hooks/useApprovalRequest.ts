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

      const insertionPayload: any = {
        user_id: user.id,
        requester_role: userRole,
        action_type: request.action_type,
        target_id: request.target_id,
        payload: request.payload,
        status: 'pending',
      };
      
      if (request.action_type === 'free_table') {
        insertionPayload.mesa_id_fk = request.target_id;
      } else if (request.action_type === 'apply_discount') {
        insertionPayload.item_pedido_id_fk = request.target_id;
      }
      
      const { data: insertedRequest, error } = await supabase
        .from("approval_requests")
        .insert(insertionPayload)
        .select('id')
        .single();
        
      if (error) {
        console.error("[ApprovalRequest] Erro ao inserir solicitação:", error);
        throw error;
      }
      return insertedRequest.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_approval_requests"] });
      showSuccess("Solicitação enviada para aprovação!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const executeActionDirectly = async (request: RequestPayload) => {
    // 1. Cria a solicitação (temporariamente como 'pending')
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !userRole) {
        showError("Usuário não autenticado.");
        return false;
    }
    
    const insertionPayload: any = {
        user_id: user.id,
        requester_role: userRole,
        action_type: request.action_type,
        target_id: request.target_id,
        payload: request.payload,
        status: 'pending',
    };
    
    if (request.action_type === 'free_table') {
        insertionPayload.mesa_id_fk = request.target_id;
    } else if (request.action_type === 'apply_discount') {
        insertionPayload.item_pedido_id_fk = request.target_id;
    }

    const { data: insertedRequest, error: insertError } = await supabase
        .from("approval_requests")
        .insert(insertionPayload)
        .select('id')
        .single();
        
    if (insertError) {
        showError(`Falha ao criar solicitação de execução: ${insertError.message}`);
        return false;
    }
    const requestId = insertedRequest.id;

    // 2. Chama o Edge Function de processamento para aprovar e executar imediatamente
    try {
        const { data, error: executionError } = await supabase.functions.invoke('process-approval-request', {
            body: { request_id: requestId, action: 'approve' },
        });
        
        if (executionError) throw executionError;
        if (!data.success) throw new Error(data.error || "Falha na execução da ação.");

        // 3. Invalida queries relevantes
        queryClient.invalidateQueries({ queryKey: ["pending_approval_requests"] });
        queryClient.invalidateQueries({ queryKey: ["mesas"] });
        queryClient.invalidateQueries({ queryKey: ["salaoData"] });
        queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
        queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
        
        showSuccess(data.message || "Ação executada com sucesso!");
        return true;
        
    } catch (error: any) {
        // Se falhar, o status da requisição no banco deve ser 'rejected' ou o erro do RPC
        // O Edge Function process-approval-request já deve ter lidado com a atualização do status para 'rejected' em caso de falha.
        showError(`Falha ao executar ação: ${error.message}`);
        
        // Invalida para garantir que o status 'rejected' seja refletido
        queryClient.invalidateQueries({ queryKey: ["pending_approval_requests"] });
        return false;
    }
  };

  const requestApproval = async (request: RequestPayload) => {
    if (!userRole) {
        showError("Aguarde, a função do usuário ainda está sendo carregada.");
        return false;
    }
    
    const rolesThatRequireApproval: UserRole[] = ['balcao', 'garcom', 'cozinha'];
    
    if (rolesThatRequireApproval.includes(userRole)) {
      // Se for um usuário que precisa de aprovação, cria a solicitação (status pending)
      createRequestMutation.mutate(request);
      return false; // Indica que a ação não foi executada diretamente
    } else {
      // Se for Admin/Gerente/Superadmin, executa a ação diretamente via server-side logic
      return executeActionDirectly(request);
    }
  };

  return {
    requestApproval,
    isRequesting: createRequestMutation.isPending,
  };
}