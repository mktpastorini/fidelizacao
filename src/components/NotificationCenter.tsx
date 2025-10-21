import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Phone, AlertTriangle, Cake, ShieldAlert, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LowStockProduct, ApprovalRequest, UserRole } from "@/types/supabase";
import { Separator } from "@/components/ui/separator";
import { ApprovalRequestCard } from "./Notification/ApprovalRequestCard";
import { useSettings } from "@/contexts/SettingsContext";
import { showError, showSuccess } from "@/utils/toast";
import { useState } from "react"; // Importando useState

type BirthdayClient = {
  nome: string;
  whatsapp: string | null;
};

async function fetchTodaysBirthdays(): Promise<BirthdayClient[]> {
  const { data, error } = await supabase.rpc('get_todays_birthdays');
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchLowStockProducts(): Promise<LowStockProduct[]> {
  const { data, error } = await supabase.rpc('get_low_stock_products');
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchPendingApprovalRequests(userRole: UserRole): Promise<ApprovalRequest[]> {
  // Apenas Admins, Gerentes e Superadmins podem ver solicitações pendentes
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

  if (error) throw new Error(error.message);
  return data as ApprovalRequest[] || [];
}

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const { userRole } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: birthdayClients } = useQuery({
    queryKey: ["todays_birthdays"],
    queryFn: fetchTodaysBirthdays,
    refetchInterval: 60000,
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["low_stock_products"],
    queryFn: fetchLowStockProducts,
    refetchInterval: 60000,
  });

  const { data: pendingRequests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["pending_approval_requests"],
    queryFn: () => fetchPendingApprovalRequests(userRole!),
    enabled: !!userRole && ['superadmin', 'admin', 'gerente'].includes(userRole),
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

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
      queryClient.invalidateQueries({ queryKey: ["mesas"] }); // Invalida mesas e pedidos
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess(data.message);
    },
    onError: (error: Error) => showError(error.message),
    onSettled: () => setIsProcessing(false),
  });

  const handleProcessRequest = (requestId: string, action: 'approve' | 'reject') => {
    processRequestMutation.mutate({ requestId, action });
  };

  const birthdayCount = birthdayClients?.length || 0;
  const lowStockCount = lowStockProducts?.length || 0;
  const requestCount = pendingRequests?.length || 0;
  const totalCount = birthdayCount + lowStockCount + requestCount;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {totalCount > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">{totalCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Central de Notificações</h4>
            <p className="text-sm text-muted-foreground">
              Você tem {totalCount} alerta(s) pendente(s).
            </p>
          </div>
          
          {/* Alertas de Aprovação (Apenas para Gerentes/Admins) */}
          {requestCount > 0 && (
            <>
              <div className="space-y-2">
                <h5 className="flex items-center font-semibold text-warning"><ShieldAlert className="w-4 h-4 mr-2" /> Aprovações Pendentes ({requestCount})</h5>
                {isLoadingRequests ? (
                    <div className="flex items-center justify-center p-4"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...</div>
                ) : (
                    <div className="grid gap-2">
                        {pendingRequests?.map((request) => (
                            <ApprovalRequestCard 
                                key={request.id} 
                                request={request} 
                                onProcess={handleProcessRequest} 
                                isProcessing={isProcessing}
                            />
                        ))}
                    </div>
                )}
              </div>
              {(birthdayCount > 0 || lowStockCount > 0) && <Separator />}
            </>
          )}

          {/* Alertas de Estoque Baixo */}
          {lowStockCount > 0 && (
            <>
              <div className="space-y-2">
                <h5 className="flex items-center font-semibold text-warning"><AlertTriangle className="w-4 h-4 mr-2" /> Estoque Baixo ({lowStockCount})</h5>
                <div className="grid gap-2">
                  {lowStockProducts?.map((product) => (
                    <div key={product.id} className="grid gap-1 text-sm">
                      <p className="font-medium leading-none">{product.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Estoque: {product.estoque_atual} (Alerta em: {product.alerta_estoque_baixo})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {birthdayCount > 0 && <Separator />}
            </>
          )}

          {/* Alertas de Aniversário */}
          {birthdayCount > 0 && (
            <div className="space-y-2">
              <h5 className="flex items-center font-semibold text-primary"><Cake className="w-4 h-4 mr-2" /> Aniversariantes ({birthdayCount})</h5>
              <div className="grid gap-2">
                {birthdayClients?.map((client) => (
                  <div key={client.nome} className="grid gap-1 text-sm">
                    <p className="font-medium leading-none">{client.nome}</p>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <Phone className="w-3 h-3 mr-2" /> {client.whatsapp || "Sem telefone"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalCount === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma notificação no momento.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}