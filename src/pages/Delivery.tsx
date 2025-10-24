import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pedido, ItemPedido } from "@/types/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Package } from "lucide-react";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

async function fetchDeliveryOrders(): Promise<DeliveryOrder[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("order_type", "IFOOD")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as DeliveryOrder[]) || [];
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DeliveryPage() {
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ["deliveryOrders"],
    queryFn: fetchDeliveryOrders,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberto': return <Badge variant="secondary">Pendente</Badge>;
      case 'pago': return <Badge className="bg-green-500 text-white">Entregue</Badge>;
      case 'cancelado': return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pedidos de Delivery (iFood)</h1>
        <p className="text-muted-foreground mt-2">Histórico e status de todos os pedidos recebidos via iFood.</p>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <p className="text-destructive">Erro ao carregar pedidos de delivery.</p>
        ) : orders && orders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const total = order.delivery_details?.total?.orderAmount || 0;
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{order.delivery_details?.customer?.name || "N/A"}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4" />
            <p>Nenhum pedido de delivery recebido ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}