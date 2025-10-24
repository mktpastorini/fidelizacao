import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { CookPerformanceReport } from "@/components/cozinha/CookPerformanceReport";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type KitchenItem = ItemPedido & {
  pedido: {
    id: string;
    mesa: { numero: number } | null;
    order_type?: 'SALAO' | 'IFOOD';
    delivery_details?: any;
  } | null;
  cliente: { nome: string } | null;
  cozinheiro: { nome: string } | null;
};

async function fetchKitchenItems(): Promise<KitchenItem[]> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const orFilter = `status.in.("pendente","preparando"),and(status.eq.entregue,updated_at.gt.${thirtyMinutesAgo.toISOString()})`;

  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      *,
      pedido:pedidos!inner(id, status, order_type, delivery_status, delivery_details, mesa:mesas(numero)),
      cliente:clientes!consumido_por_cliente_id(nome),
      cozinheiro:cozinheiros!cozinheiro_id(nome)
    `)
    .or(orFilter)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as KitchenItem[];
}

export default function CozinhaPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("kanban");

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["kitchenItems"],
    queryFn: fetchKitchenItems,
    refetchInterval: 15000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus, cookId }: { itemId: string; newStatus: 'preparando' | 'entregue'; cookId: string | null }) => {
      const updatePayload: Partial<ItemPedido> = { status: newStatus };
      
      if (newStatus === 'preparando') {
        updatePayload.cozinheiro_id = cookId;
        updatePayload.hora_inicio_preparo = new Date().toISOString();
        updatePayload.hora_entrega = null;
      } else if (newStatus === 'entregue') {
        updatePayload.hora_entrega = new Date().toISOString();
        if (!items?.find(i => i.id === itemId)?.cozinheiro_id) {
            updatePayload.cozinheiro_id = cookId;
        }
      }
      
      const { error } = await supabase
        .from("itens_pedido")
        .update(updatePayload)
        .eq("id", itemId);
      if (error) throw error;

      // Notifica o iFood se for um pedido de delivery
      const item = items?.find(i => i.id === itemId);
      if (item?.pedido?.order_type === 'IFOOD') {
        const { error: ifoodError } = await supabase.functions.invoke('update-ifood-status', {
          body: { pedido_id: item.pedido.id, new_status: newStatus },
        });
        if (ifoodError) {
          // Mostra um erro, mas não impede o fluxo principal
          showError(`Status atualizado, mas falha ao notificar iFood: ${ifoodError.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Status do item atualizado!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleStatusChange = (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string | null) => {
    updateStatusMutation.mutate({ itemId, newStatus, cookId });
  };

  const filteredItems = items?.filter(item => {
    const nome = item.nome_produto.toUpperCase();
    if (nome.startsWith('[RESGATE]') || nome.startsWith('[RODIZIO]')) {
      return false;
    }
    if (item.status === 'pendente' || item.status === 'preparando' || item.status === 'entregue') {
      return true;
    }
    return false;
  }) || [];

  const prepPendingItems = filteredItems.filter(item => 
    item.status === 'pendente' && 
    item.requer_preparo
  );
  const deliveryPendingItems = filteredItems.filter(item => item.status === 'pendente' && !item.requer_preparo);
  const preparingItems = filteredItems.filter(item => item.status === 'preparando');
  const deliveredItems = filteredItems.filter(item => item.status === 'entregue');

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
        <p className="text-muted-foreground mt-1">Acompanhe o preparo dos pedidos em tempo real.</p>
      </div>

      <Tabs defaultValue="kanban" onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="kanban">Kanban de Pedidos</TabsTrigger>
            <TabsTrigger value="relatorio">Relatório de Desempenho</TabsTrigger>
          </TabsList>
          {activeTab === 'kanban' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["kitchenItems"] })}
              disabled={updateStatusMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          )}
        </div>
        
        <TabsContent value="kanban" className="mt-0 flex-1 flex flex-col min-h-0">
          {isLoading ? (
            <div className="flex-1 flex gap-4 h-full">
              <Skeleton className="flex-1" />
              <Skeleton className="flex-1" />
              <Skeleton className="flex-1" />
              <Skeleton className="flex-1" />
            </div>
          ) : isError ? (
            <p className="text-destructive">Erro ao carregar os pedidos.</p>
          ) : (
            <div className="flex-1 flex gap-4 h-full">
              <KanbanColumn title="Aguardando Preparo" items={prepPendingItems} onStatusChange={handleStatusChange} borderColor="border-warning" />
              <KanbanColumn title="Em Preparo" items={preparingItems} onStatusChange={handleStatusChange} borderColor="border-primary" />
              <KanbanColumn title="Aguardando Entrega (Bar)" items={deliveryPendingItems} onStatusChange={handleStatusChange} borderColor="border-blue-500" />
              <KanbanColumn title="Pronto/Entregue" items={deliveredItems} onStatusChange={handleStatusChange} borderColor="border-success" />
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="relatorio" className="mt-6 flex-1 min-h-0">
          <CookPerformanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}