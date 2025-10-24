import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pedido, ItemPedido } from "@/types/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, PlusCircle } from "lucide-react";
import { DeliveryOrderCard } from "@/components/delivery/DeliveryOrderCard";
import { Button } from "@/components/ui/button";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

async function fetchActiveDeliveryOrders(): Promise<DeliveryOrder[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .in("order_type", ["IFOOD", "DELIVERY"])
    .not("status", "in", "('pago', 'cancelado')") // Busca apenas pedidos ativos
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as DeliveryOrder[]) || [];
}

export default function DeliveryPage() {
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["activeDeliveryOrders"],
    queryFn: fetchActiveDeliveryOrders,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Painel de Delivery</h1>
          <p className="text-muted-foreground mt-2">Gerencie todos os pedidos para entrega, sejam eles do iFood ou manuais.</p>
        </div>
        <Button disabled>
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
        ) : isError ? (
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
    </div>
  );
}