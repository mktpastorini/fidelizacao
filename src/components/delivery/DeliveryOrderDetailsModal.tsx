import { Pedido, ItemPedido } from "@/types/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Clock, User, Hash, DollarSign, MapPin, Phone, ArrowRight, CheckCircle, Utensils, Bike, Check } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

type DeliveryOrderDetailsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  order: DeliveryOrder | null;
  onStatusChange: (orderId: string, newStatus: string) => void;
  isUpdatingStatus: boolean;
  onOpenChecklist: (order: DeliveryOrder) => void;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusMap: { [key: string]: { label: string; color: string; icon: React.ElementType } } = {
  awaiting_confirmation: { label: "Aguardando Confirmação", color: "bg-yellow-500", icon: Clock },
  CONFIRMED: { label: "Confirmado", color: "bg-cyan-500", icon: Check },
  in_preparation: { label: "Em Preparo", color: "bg-blue-500", icon: Utensils },
  ready_for_delivery: { label: "Pronto para Entrega", color: "bg-purple-500", icon: Package },
  out_for_delivery: { label: "Saiu para Entrega", color: "bg-orange-500", icon: Bike },
  delivered: { label: "Entregue", color: "bg-green-600", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-red-600", icon: CheckCircle },
  aberto: { label: "Pendente (iFood)", color: "bg-yellow-500", icon: Clock },
  pago: { label: "Entregue (iFood)", color: "bg-green-600", icon: CheckCircle },
};

const statusFlow: { [key: string]: { next: string; label: string; icon: React.ElementType } } = {
  awaiting_confirmation: { next: "CONFIRMED", label: "Confirmar Pedido", icon: Check },
  aberto: { next: "CONFIRMED", label: "Confirmar Pedido", icon: Check },
  // Não há ação para 'CONFIRMED' aqui, pois a ação agora é da cozinha
  ready_for_delivery: { next: "out_for_delivery", label: "Enviar para Entrega", icon: Bike },
  out_for_delivery: { next: "delivered", label: "Marcar como Entregue", icon: CheckCircle },
};

export function DeliveryOrderDetailsModal({ isOpen, onOpenChange, order, onStatusChange, isUpdatingStatus, onOpenChecklist }: DeliveryOrderDetailsModalProps) {
  if (!order) return null;

  const total = order.delivery_details?.total?.orderAmount || order.itens_pedido.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0);
  const customer = order.delivery_details?.customer;
  const address = order.delivery_details?.delivery?.deliveryAddress;
  const orderId = order.ifood_order_id ? `iFood #${order.ifood_order_id.slice(-4)}` : `Pedido #${order.id.slice(0, 4)}`;
  const currentStatus = order.delivery_status || order.status;
  const statusInfo = statusMap[currentStatus] || { label: "Desconhecido", color: "bg-gray-500", icon: Package };
  const nextAction = statusFlow[currentStatus];

  const handleNextAction = () => {
    if (nextAction) {
      console.log(`[DEBUG] Botão de próxima ação clicado. Ação: ${nextAction.label}, Novo Status: ${nextAction.next}, Pedido ID: ${order.id}`);
      if (currentStatus === 'ready_for_delivery') {
        console.log("[DEBUG] Abrindo checklist...");
        onOpenChecklist(order);
      } else {
        console.log("[DEBUG] Chamando onStatusChange...");
        onStatusChange(order.id, nextAction.next);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {order.order_type === 'IFOOD' ? <img src="/ifood-icon.png" alt="iFood" className="w-6 h-6" /> : <Package className="w-6 h-6" />}
            Detalhes do Pedido
          </DialogTitle>
          <div className="text-sm text-muted-foreground flex items-center justify-between">
            <span>{orderId} - {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            <Badge className={`${statusInfo.color} text-white`}>{statusInfo.label}</Badge>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-secondary">
              <h3 className="font-semibold mb-2 flex items-center gap-2"><User className="w-4 h-4" /> Cliente</h3>
              <p>{customer?.name || "Cliente Balcão"}</p>
              {customer?.phone && <div className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="w-3 h-3" /> {customer.phone}</div>}
            </div>
            {address && (
              <div className="p-4 border rounded-lg bg-secondary">
                <h3 className="font-semibold mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> Endereço de Entrega</h3>
                <p>{address.streetName}, {address.streetNumber} {address.complement && `- ${address.complement}`}</p>
                <p className="text-sm text-muted-foreground">{address.neighborhood}, {address.city}</p>
              </div>
            )}
            <div className="p-4 border rounded-lg bg-secondary">
              <h3 className="font-semibold mb-2">Itens do Pedido</h3>
              <ul className="space-y-1">
                {order.itens_pedido.map(item => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span>{item.quantidade}x {item.nome_produto}</span>
                    <span>{formatCurrency((item.preco || 0) * item.quantidade)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center pt-4 border-t">
          <div className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Total: {formatCurrency(total)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            {nextAction && (
              <Button 
                onClick={handleNextAction}
                disabled={isUpdatingStatus}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isUpdatingStatus ? "Atualizando..." : <><nextAction.icon className="w-4 h-4 mr-2" /> {nextAction.label}</>}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}