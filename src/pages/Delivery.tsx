import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pedido, ItemPedido, Cliente, Produto } from "@/types/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, PlusCircle } from "lucide-react";
import { DeliveryOrderCard } from "@/components/delivery/DeliveryOrderCard";
import { Button } from "@/components/ui/button";
import { NewDeliveryOrderDialog } from "@/components/delivery/NewDeliveryOrderDialog";
import { showError, showSuccess } from "@/utils/toast";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

async function fetchActiveDeliveryOrders(): Promise<DeliveryOrder[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .in("order_type", ["IFOOD", "DELIVERY"])
    .not("status", "in", "('pago', 'cancelado')")
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

  const { data: orders, isLoading: isLoadingOrders, isError: isOrdersError } = useQuery({
    queryKey: ["activeDeliveryOrders"],
    queryFn: fetchActiveDeliveryOrders,
    refetchInterval: 30000,
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
          status: 'aberto', // Mantém o status 'aberto' para consistência
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

  const isLoading = isLoadingOrders || isLoadingClientes || isLoadingProdutos;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Painel de Delivery</h1>
          <p className="text-muted-foreground mt-2">Gerencie todos os pedidos para entrega, sejam eles do iFood ou manuais.</p>
        </div>
        <Button onClick={() => setIsNewOrderOpen(true)} disabled={isLoading}>
            <PlusCircle className="w-4 h-4 mr-2" /> Novo Pedido Delivery
        </Button>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isOrdersError ? (
          <p className="text-destructive">Erro ao carregar pedidos de delivery.</p>
        ) : orders && orders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <DeliveryOrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4" />
            <p>Nenhum pedido de delivery ativo no momento.</p>
          </div>
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
    </div>
  );
}