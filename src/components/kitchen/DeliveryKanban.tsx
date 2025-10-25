"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { Skeleton } from "@/components/ui/skeleton";
import { showError, showSuccess } from "@/utils/toast";

type KitchenItem = ItemPedido & {
  pedido: {
    id: string;
    mesa: { numero: number } | null;
    order_type?: 'SALAO' | 'IFOOD' | 'DELIVERY';
    delivery_details?: any;
  } | null;
  cliente: { nome: string } | null;
  cozinheiro: { nome: string } | null;
};

async function fetchDeliveryKitchenItems(): Promise<KitchenItem[]> {
  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      *,
      pedido:pedidos!inner(id, mesa:mesas(numero), order_type, delivery_details),
      cliente:clientes!consumido_por_cliente_id(nome),
      cozinheiro:cozinheiros(nome)
    `)
    .in("pedido.order_type", ["DELIVERY", "IFOOD"])
    .in("pedido.delivery_status", ["CONFIRMED", "in_preparation", "ready_for_delivery"])
    .eq("requer_preparo", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as KitchenItem[] || [];
}

export function DeliveryKanban() {
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["deliveryKitchenItems"],
    queryFn: fetchDeliveryKitchenItems,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus, cookId }: { itemId: string; newStatus: 'preparando' | 'entregue'; cookId: string | null }) => {
      const updateData: Partial<ItemPedido> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'preparando') {
        updateData.cozinheiro_id = cookId;
        updateData.hora_inicio_preparo = new Date().toISOString();
      } else if (newStatus === 'entregue') {
        updateData.hora_entrega = new Date().toISOString();
      }

      const { error } = await supabase
        .from("itens_pedido")
        .update(updateData)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryKitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["activeDeliveryOrders"] }); // Invalidate delivery page
      showSuccess("Status do item atualizado!");
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleStatusChange = (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string | null) => {
    updateStatusMutation.mutate({ itemId, newStatus, cookId });
  };

  const pendingItems = items?.filter(item => item.status === 'pendente') || [];
  const preparingItems = items?.filter(item => item.status === 'preparando') || [];
  const readyItems = items?.filter(item => item.status === 'entregue') || [];

  if (isLoading) {
    return (
      <div className="flex-1 flex gap-4">
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-4 h-full">
      <KanbanColumn title="Pendente" items={pendingItems} onStatusChange={handleStatusChange} borderColor="border-yellow-500" />
      <KanbanColumn title="Em Preparo" items={preparingItems} onStatusChange={handleStatusChange} borderColor="border-blue-500" />
      <KanbanColumn title="Pronto para Entrega" items={readyItems} onStatusChange={handleStatusChange} borderColor="border-green-500" />
    </div>
  );
}