import { Pedido, ItemPedido } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Clock, User, Hash, DollarSign, ArrowRight } from "lucide-react";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

type DeliveryOrderCardProps = {
  order: DeliveryOrder;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusMap: { [key: string]: { label: string; color: string } } = {
  awaiting_confirmation: { label: "Aguardando Confirmação", color: "bg-yellow-500" },
  in_preparation: { label: "Em Preparo", color: "bg-blue-500" },
  ready_for_delivery: { label: "Pronto para Entrega", color: "bg-purple-500" },
  out_for_delivery: { label: "Saiu para Entrega", color: "bg-orange-500" },
  delivered: { label: "Entregue", color: "bg-green-600" },
  cancelled: { label: "Cancelado", color: "bg-red-600" },
  // Fallbacks for old statuses
  aberto: { label: "Pendente (iFood)", color: "bg-yellow-500" },
  pago: { label: "Entregue (iFood)", color: "bg-green-600" },
};

export function DeliveryOrderCard({ order }: DeliveryOrderCardProps) {
  const total = order.delivery_details?.total?.orderAmount || order.itens_pedido.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0);
  const customerName = order.delivery_details?.customer?.name || "Cliente Balcão";
  const orderId = order.ifood_order_id ? `iFood #${order.ifood_order_id.slice(-4)}` : `Pedido #${order.id.slice(0, 4)}`;
  
  const statusInfo = statusMap[order.delivery_status || order.status] || { label: "Desconhecido", color: "bg-gray-500" };

  return (
    <Card className="flex flex-col cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {order.order_type === 'IFOOD' ? <img src="/ifood-icon.png" alt="iFood" className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              {customerName}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              <Hash className="w-3 h-3" /> {orderId}
            </CardDescription>
          </div>
          <Badge className={`${statusInfo.color} text-white`}>{statusInfo.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        <ul className="text-sm text-muted-foreground list-disc list-inside">
          {order.itens_pedido.slice(0, 3).map(item => (
            <li key={item.id}>{item.quantidade}x {item.nome_produto}</li>
          ))}
          {order.itens_pedido.length > 3 && <li>... e mais {order.itens_pedido.length - 3} item(ns)</li>}
        </ul>
        <div className="text-xs text-muted-foreground flex items-center gap-2 pt-2 border-t">
          <Clock className="w-3 h-3" />
          <span>{format(new Date(order.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <div className="text-lg font-bold flex items-center gap-1">
          <DollarSign className="w-4 h-4" />
          {formatCurrency(total)}
        </div>
        <div className="text-xs text-muted-foreground flex items-center">
          Ver Detalhes <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </CardFooter>
    </Card>
  );
}