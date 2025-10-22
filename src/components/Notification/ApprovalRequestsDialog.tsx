import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ApprovalRequest, UserRole } from "@/types/supabase";
import { useSettings } from "@/contexts/SettingsContext";
import { showError, showSuccess } from "@/utils/toast";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { ApprovalRequestItem } from "./ApprovalRequestItem"; // Importado o novo componente
import { Badge } from "@/components/ui/badge"; // IMPORTAÇÃO CORRIGIDA

// Função de busca
async function fetchPendingApprovalRequests(userRole: UserRole): Promise<ApprovalRequest[]> {
  if (!['superadmin', 'admin', 'gerente'].includes(userRole)) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("approval_requests")
    .select(`
      *,
      requester:profiles!user_id(first_name, last_name, role),
      mesa:mesas!mesa_id_fk(numero),
      item_pedido:itens_pedido!item_pedido_id_fk(id, nome_produto, quantidade, preco, desconto_percentual, desconto_motivo)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("RLS Error fetching approval requests:", error);
    throw new Error(error.message);
  }
  
  return data as ApprovalRequest[] || [];
}

export function ApprovalRequestsDialog() {
  const queryClient = useQueryClient();
  const { userRole, isLoading: isLoadingSettings } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const isManagerOrAdmin = !!userRole && ['superadmin', 'admin', 'gerente'].includes(userRole);

  const { data: pendingRequests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["pending_approval_requests"],
    queryFn: () => fetchPendingApprovalRequests(userRole!),
    enabled: isManagerOrAdmin && !isLoadingSettings,
    refetchInterval: 15000, // Atualiza a cada 15 segundos
  });

  const pendingCount = pendingRequests?.length || 0;

  const processRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approve' | 'reject' }) => {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('process-approval-request', {
        body: { request_id: requestId, action },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      // Invalida todas as queries relacionadas para refletir a mudança
      queryClient.invalidateQueries({ queryKey: ["pending_approval_requests"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess(data.message);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
    onSettled: () => setIsProcessing(false),
  });

  const handleProcessRequest = (requestId: string, action: 'approve' | 'reject') => {
    processRequestMutation.mutate({ requestId, action });
  };

  if (!isManagerOrAdmin) {
    return null;
  }

  return (
    <>
      {/* Botão de Notificação no Header (Sininho) */}
      <Button 
        variant="outline" 
        size="icon" 
        onClick={() => setIsOpen(true)}
        className="relative"
      >
        <ShieldAlert className="h-[1.2rem] w-[1.2rem] text-warning-foreground" />
        {pendingCount > 0 && (
          <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
            {pendingCount}
          </Badge>
        )}
      </Button>

      {/* Diálogo Principal de Aprovações */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-warning-foreground" />
              Aprovações Pendentes ({pendingCount})
            </DialogTitle>
            <DialogDescription>
              Revise e aprove ou rejeite as solicitações de ações sensíveis dos colaboradores.
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingRequests ? (
            <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /> Carregando solicitações...</div>
          ) : pendingRequests && pendingRequests.length > 0 ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <ApprovalRequestItem
                    key={request.id}
                    request={request}
                    onProcess={handleProcessRequest}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma solicitação de aprovação pendente.</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}