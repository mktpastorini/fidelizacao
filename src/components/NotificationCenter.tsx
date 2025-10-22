import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Phone, AlertTriangle, Cake, ShieldAlert, Loader2, Utensils, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LowStockProduct, ApprovalRequest, UserRole, ItemPedido } from "@/types/supabase";
import { Separator } from "@/components/ui/separator";
import { ApprovalRequestCard } from "./Notification/ApprovalRequestCard";
import { useSettings } from "@/contexts/SettingsContext";
import { showError, showSuccess } from "@/utils/toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area"; // Importando ScrollArea

type BirthdayClient = {
  nome: string;
  whatsapp: string | null;
};

type PendingOrderItem = ItemPedido & {
  mesa: { numero: number } | null;
  cliente: { nome: string } | null;
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

async function fetchPendingOrderItems(): Promise<PendingOrderItem[]> {
  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      id, nome_produto, quantidade, created_at, status,
      pedido:pedidos!inner(mesa:mesas(numero)),
      cliente:clientes!consumido_por_cliente_id(nome)
    `)
    .in("status", ["pendente", "preparando"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  
  // Mapeia e filtra para garantir que apenas itens com mesa associada sejam retornados
  return data.filter(item => item.pedido?.mesa)
    .map(item => ({
      ...item,
      mesa: item.pedido?.mesa,
      cliente: item.cliente,
    })) as PendingOrderItem[] || [];
}

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const { userRole } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);

  const isManagerOrAdmin = !!userRole && ['superadmin', 'admin', 'gerente'].includes(userRole);
  const isSaloonStaff = !!userRole && ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'].includes(userRole);

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
    enabled: isManagerOrAdmin,
    refetchInterval: 10000,
  });

  const { data: pendingOrderItems } = useQuery({
    queryKey: ["pendingOrderItems"],
    queryFn: fetchPendingOrderItems,
    enabled: isSaloonStaff,
    refetchInterval: 10000,
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
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
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
  const orderItemCount = pendingOrderItems?.length || 0;

  // Garçons/Balcões só veem Pedidos e Aniversários
  const totalCount = isManagerOrAdmin 
    ? birthdayCount + lowStockCount + requestCount + orderItemCount
    : isSaloonStaff
      ? birthdayCount + orderItemCount
      : birthdayCount; // Cozinha só vê aniversários aqui (o painel é o foco)

  const shouldShowRequests = isManagerOrAdmin && requestCount > 0;
  const shouldShowLowStock = isManagerOrAdmin && lowStockCount > 0;
  const shouldShowOrderItems = isSaloonStaff && orderItemCount > 0;
  const shouldShowBirthdays = birthdayCount > 0;

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
          
          <ScrollArea className="max-h-[70vh] pr-4"> {/* Adicionado ScrollArea aqui */}
            <div className="grid gap-4">
              {/* Alertas de Aprovação (Apenas para Gerentes/Admins) */}
              {shouldShowRequests && (
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
                  {(shouldShowOrderItems || shouldShowLowStock || shouldShowBirthdays) && <Separator />}
                </>
              )}

              {/* Alertas de Pedidos Pendentes/Em Preparo (Para Garçons/Balcões/Gerentes) */}
              {shouldShowOrderItems && (
                <>
                  <div className="space-y-2">
                    <h5 className="flex items-center font-semibold text-primary"><Utensils className="w-4 h-4 mr-2" /> Pedidos em Aberto ({orderItemCount})</h5>
                    <div className="grid gap-2">
                      {pendingOrderItems?.map((item) => (
                        <div key={item.id} className="grid gap-1 text-sm p-2 rounded-md bg-secondary">
                          <p className="font-medium leading-none flex justify-between items-center">
                            <span>{item.nome_produto} (x{item.quantidade})</span>
                            <Badge variant="outline" className={cn(item.status === 'pendente' ? 'bg-warning/20 text-warning-foreground' : 'bg-primary/20 text-primary')}>
                              {item.status === 'pendente' ? 'Novo' : 'Preparo'}
                            </Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Mesa {item.pedido?.mesa?.numero || '?'}{item.cliente?.nome && ` | Consumidor: ${item.cliente.nome}`}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(shouldShowLowStock || shouldShowBirthdays) && <Separator />}
                </>
              )}

              {/* Alertas de Estoque Baixo */}
              {shouldShowLowStock && (
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
                  {shouldShowBirthdays && <Separator />}
                </>
              )}

              {/* Alertas de Aniversário */}
              {shouldShowBirthdays && (
                <div className="space-y-2">
                  <h5 className="flex items-center font-semibold text-pink-500"><Cake className="w-4 h-4 mr-2" /> Aniversariantes ({birthdayCount})</h5>
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
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}