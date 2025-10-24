import { DeliveryOrderCard } from "./DeliveryOrderCard";
import { Pedido, ItemPedido } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

type DeliveryKanbanColumnProps = {
  title: string;
  orders: DeliveryOrder[];
  onViewDetails: (order: DeliveryOrder) => void;
  borderColor: string;
};

export function DeliveryKanbanColumn({ title, orders, onViewDetails, borderColor }: DeliveryKanbanColumnProps) {
  return (
    <div className={cn("flex-1 bg-card rounded-lg p-4 border-t-4 flex flex-col h-full", borderColor)}>
      <h2 className="text-lg font-semibold mb-4 text-foreground shrink-0">{title} ({orders.length})</h2>
      <ScrollArea className="flex-1 min-h-0">
        <div className="pr-4 space-y-4">
          {orders.length > 0 ? (
            orders.map(order => (
              <div key={order.id} onClick={() => onViewDetails(order)}>
                <DeliveryOrderCard order={order} />
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-sm text-muted-foreground text-center">Nenhum pedido aqui.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}