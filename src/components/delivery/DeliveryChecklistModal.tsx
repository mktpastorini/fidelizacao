import { useState, useEffect } from "react";
import { Pedido, ItemPedido } from "@/types/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bike, PackageCheck } from "lucide-react";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

type DeliveryChecklistModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  order: DeliveryOrder | null;
  onConfirmDispatch: (orderId: string) => void;
  isDispatching: boolean;
};

export function DeliveryChecklistModal({
  isOpen,
  onOpenChange,
  order,
  onConfirmDispatch,
  isDispatching,
}: DeliveryChecklistModalProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      setCheckedItems(new Set());
    }
  }, [isOpen]);

  if (!order) return null;

  const allItemsChecked = checkedItems.size === order.itens_pedido.length;

  const handleCheckChange = (itemId: string, checked: boolean) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    if (allItemsChecked) {
      onConfirmDispatch(order.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-6 h-6" /> Checklist de Entrega
          </DialogTitle>
          <DialogDescription>
            Confirme todos os itens do pedido antes de despachar para entrega.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="mb-2 text-sm font-semibold">Pedido: <span className="text-primary">{order.ifood_order_id ? `iFood #${order.ifood_order_id.slice(-4)}` : `Pedido #${order.id.slice(0, 4)}`}</span></p>
          <ScrollArea className="h-64 border rounded-md p-4">
            <div className="space-y-3">
              {order.itens_pedido.map(item => (
                <div key={item.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`item-${item.id}`}
                    checked={checkedItems.has(item.id)}
                    onCheckedChange={(checked) => handleCheckChange(item.id, !!checked)}
                  />
                  <Label htmlFor={`item-${item.id}`} className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {item.quantidade}x {item.nome_produto}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!allItemsChecked || isDispatching}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isDispatching ? "Despachando..." : <><Bike className="w-4 h-4 mr-2" /> Confirmar e Despachar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}