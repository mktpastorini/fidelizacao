import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pedido, ItemPedido, Cliente, Produto } from "@/types/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, PlusCircle } from "lucide-react";
import { DeliveryKanbanColumn } from "@/components/delivery/DeliveryKanbanColumn";
import { Button } from "@/components/ui/button";
import { NewDeliveryOrderDialog } from "@/components/delivery/NewDeliveryOrderDialog";
import { DeliveryOrderDetailsModal } from "@/components/delivery/DeliveryOrderDetailsModal";
import { showError, showSuccess } from "@/utils/toast";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

async function fetchActiveDeliveryOrders(): Promise<DeliveryOrder[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .in("order_type", ["IFOOD", "DELIVERY"])
    .neq("delivery_status", "delivered")
    .neq("delivery_status", "cancelled")
    .neq("status", "pago")
    .neq("status", "cancelado")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DeliveryOrder[]) || [];
}

async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

export default function DeliveryPage() {
  const queryClient = useQueryClient();
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);

  const { data: orders, isLoading: isLoadingOrders, isError: isOrdersError } = useQuery({
    queryKey: ["activeDeliveryOrders"],
    queryFn: fetchActiveDeliveryOrders,
    refetchInterval: 15000,
  });

  const { data: clientes, isLoading: isLoadingClientes } = useQuery({
    queryKey: ["clientes_list_all"],
    queryFn: fetchClientes,
  });

  const { data: produtos, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ["produtos_list_all"],
    queryFn: fetchProdutos,
  });

  const createDeliveryOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const deliveryDetails = {
        customer: { name: clientes?.find(c => c.id === values.clienteId)?.nome },
        delivery: {
          deliveryAddress: {
            streetName: values.address_street,
            streetNumber: values.address_number,
            neighborhood: values.address_neighborhood,
            city: values.address_city,
            postalCode: values.address_zip,
            complement: values.address_complement,
          },
        },
      };

      const { data: newPedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          user_id: user.id,
          cliente_id: values.clienteId,
          order_type: 'DELIVERY',
          delivery_status: 'awaiting_confirmation',
          status: 'aberto',
          delivery_details: deliveryDetails,
        })
        .select('id')
        .single();
      
      if (pedidoError) throw pedidoError;

      const orderItems = values.items.map((item: any) => ({
        pedido_id: newPedido.id,
        user_id: user.id,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade,
        preco: item.preco,
        status: 'pendente',
        requer_preparo: item.requer_preparo,
      }));

      const { error: itemsError } = await supabase.from('itens_pedido').insert(orderItems);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeDeliveryOrders"] });
      showSuccess("Novo pedido de delivery criado com sucesso!");
      setIsNewOrderOpen(false);
    },
    onError: (error: Error) => {
      showError(`Falha ao criar pedido: ${error.message}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string, newStatus: string }) => {
      const { error } = await supabase
        .from("pedidos")
        .update({ delivery_status: newStatus })
        .eq("id", orderId);
      if (error) throw error;

      // Notifica o iFood se necessário
      const order = orders?.find(o => o.id === orderId);
      if (order?.order_type === 'IFOOD') {
        const { error: ifoodError } = await supabase.functions.invoke('update-ifood-status', {
          body: { pedido_id: orderId, new_status: newStatus },
        });
        if (ifoodError) {
          showError(`Status atualizado, mas falha ao notificar iFood: ${ifoodError.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeDeliveryOrders"] });
      showSuccess("Status do pedido atualizado!");
      setIsDetailsOpen(false);
    },
    onError: (error: Error) => {
      showError(`Falha ao atualizar status: ${error.message}`);
    },
  });

  const handleViewDetails = (order: DeliveryOrder) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const isLoading = isLoadingOrders || isLoadingClientes || isLoadingProdutos;

  const { awaiting, inPreparation, ready, outForDelivery } = useMemo(() => {
    const awaiting: DeliveryOrder[] = [];
    const inPreparation: DeliveryOrder[] = [];
    const ready: DeliveryOrder[] = [];
    const outForDelivery: DeliveryOrder[] = [];

    orders?.forEach(order => {
      const status = order.delivery_status || order.status;
      switch (status) {
        case 'awaiting_confirmation':
        case 'aberto': // Mapeia status antigo do iFood
          awaiting.push(order);
          break;
        case 'in_preparation':
          inPreparation.push(order);
          break;
        case 'ready_for_delivery':
          ready.push(order);
          break;
        case 'out_for_delivery':
          outForDelivery.push(order);
          break;
        default:
          break;
      }
    });

    return { awaiting, inPreparation, ready, outForDelivery };
  }, [orders]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Painel de Delivery</h1>
          <p className="text-muted-foreground mt-2">Gerencie todos os pedidos para entrega em tempo real.</p>
        </div>
        <Button onClick={() => setIsNewOrderOpen(true)} disabled={isLoading}>
            <PlusCircle className="w-4 h-4 mr-2" /> Novo Pedido Delivery
        </Button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {isLoading ? (
          <>
            <Skeleton className="flex-1" />
            <Skeleton className="flex-1" />
            <Skeleton className="flex-1" />
            <Skeleton className="flex-1" />
          </>
        ) : isOrdersError ? (
          <p className="text-destructive">Erro ao carregar pedidos de delivery.</p>
        ) : (
          <>
            <DeliveryKanbanColumn title="Aguardando Confirmação" orders={awaiting} onViewDetails={handleViewDetails} borderColor="border-yellow-500" />
            <DeliveryKanbanColumn title="Em Preparo" orders={inPreparation} onViewDetails={handleViewDetails} borderColor="border-blue-500" />
            <DeliveryKanbanColumn title="Pronto para Entrega" orders={ready} onViewDetails={handleViewDetails} borderColor="border-purple-500" />
            <DeliveryKanbanColumn title="Saiu para Entrega" orders={outForDelivery} onViewDetails={handleViewDetails} borderColor="border-orange-500" />
          </>
        )}
      </div>

      <NewDeliveryOrderDialog
        isOpen={isNewOrderOpen}
        onOpenChange={setIsNewOrderOpen}
        clientes={clientes}
        produtos={produtos}
        onSubmit={createDeliveryOrderMutation.mutate}
        isSubmitting={createDeliveryOrderMutation.isPending}
      />

      <DeliveryOrderDetailsModal
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        order={selectedOrder}
        onStatusChange={updateStatusMutation.mutate}
        isUpdatingStatus={updateStatusMutation.isPending}
      />
    </div>
  );
}