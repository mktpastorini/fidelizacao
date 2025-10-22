import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ApprovalRequest, UserRole } from "@/types/supabase";
import { useSettings } from "@/contexts/SettingsContext";
import { showError, showSuccess } from "@/utils/toast";
import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Table, Tag, Loader2, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Função de busca (copiada do NotificationCenter, mas ajustada para ser standalone)
async function fetchPendingApprovalRequests(userRole: UserRole): Promise<ApprovalRequest[]> {
  if (!['superadmin', 'admin', 'gerente'].includes(userRole)) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("approval_requests")
    .select(`
      *,
      requester:profiles(first_name, last_name, role),
      mesa:mesas(numero),
      item_pedido:itens_pedido(*)
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("RLS Error fetching approval requests:", error);
    throw new Error(error.message);
  }
  return data as ApprovalRequest[] || [];
}

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  gerente: 'Gerente',
  balcao: 'Balcão',
  garcom: 'Garçom',
  cozinha: 'Cozinha',
};

export function ApprovalAlertModal() {
  const queryClient = useQueryClient();
  const { userRole, isLoading: isLoadingSettings } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<ApprovalRequest | null>(null);

  const isManagerOrAdmin = !!userRole && ['superadmin', 'admin', 'gerente'].includes(userRole);

  const { data: pendingRequests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["pending_approval_requests"],
    queryFn: () => fetchPendingApprovalRequests(userRole!),
    enabled: isManagerOrAdmin && !isLoadingSettings,
    refetchInterval: 5000, // Verifica a cada 5 segundos
  });

  // Efeito para abrir o modal quando uma nova solicitação chega
  useEffect(() => {
    if (pendingRequests && pendingRequests.length > 0 && !currentRequest) {
      setCurrentRequest(pendingRequests[0]);
    } else if (pendingRequests && pendingRequests.length === 0) {
      setCurrentRequest(null);
    }
  }, [pendingRequests, currentRequest]);

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
      queryClient.invalidateQueries({ queryKey: ["pending_approval_requests"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess(data.message);
      setCurrentRequest(null); // Fecha o modal e passa para o próximo (se houver)
    },
    onError: (error: Error) => {
      showError(error.message);
      setIsProcessing(false);
    },
    onSettled: () => setIsProcessing(false),
  });

  if (!isManagerOrAdmin || isLoadingSettings || isLoadingRequests || !currentRequest) {
    return null;
  }

  const request = currentRequest;
  const requesterName = request.requester?.first_name || 'Usuário';
  const requesterRole = roleLabels[request.requester_role] || 'Desconhecido';
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { locale: ptBR, addSuffix: true });

  let title = "Solicitação de Aprovação";
  let description = "";
  let icon: React.ElementType = ShieldAlert;
  let iconColor = "text-yellow-500";

  switch (request.action_type) {
    case 'free_table':
      title = `Liberar Mesa ${request.mesa?.numero || '?'}`;
      description = `O usuário ${requesterName} (${requesterRole}) solicitou a liberação da Mesa ${request.mesa?.numero || '?'}. Isso irá CANCELAR o pedido aberto e remover todos os ocupantes.`;
      icon = Table;
      iconColor = "text-blue-500";
      break;
    case 'apply_discount':
      title = `Aplicar Desconto de ${request.payload.desconto_percentual}%`;
      description = `O usuário ${requesterName} (${requesterRole}) solicitou um desconto de ${request.payload.desconto_percentual}% no item "${request.item_pedido?.nome_produto || 'Item do Pedido'}". Motivo: ${request.payload.desconto_motivo || 'N/A'}`;
      icon = Tag;
      iconColor = "text-green-500";
      break;
  }

  return (
    <AlertDialog open={!!currentRequest}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className={cn("p-3 rounded-full bg-secondary", iconColor)}>
              <ShieldAlert className="w-8 h-8" />
            </div>
          </div>
          <AlertDialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <icon.type className={cn("w-6 h-6", iconColor)} />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="p-4 border rounded-lg bg-muted/50 text-sm space-y-1">
            <p className="flex items-center gap-2 font-medium">
                <User className="w-4 h-4" /> Solicitante: {requesterName} ({requesterRole})
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" /> Solicitado há {timeAgo}
            </p>
        </div>

        <AlertDialogFooter>
          <Button
            variant="destructive"
            onClick={() => processRequestMutation.mutate({ requestId: request.id, action: 'reject' })}
            disabled={isProcessing}
          >
            <XCircle className="w-4 h-4 mr-1" /> Rejeitar
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => processRequestMutation.mutate({ requestId: request.id, action: 'approve' })}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
            {isProcessing ? "Processando..." : "Aprovar Ação"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}