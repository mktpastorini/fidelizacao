"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pedido, ItemPedido } from "@/types/supabase";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type DeliveryOrder = Pedido & {
  itens_pedido: ItemPedido[];
};

type DeliveryChecklistModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  order: DeliveryOrder | null;
  onConfirmDispatch: () => void;
  isSubmitting: boolean;
};

export function DeliveryChecklistModal({
  isOpen,
  onOpenChange,
  order,
  onConfirmDispatch,
  isSubmitting,
}: DeliveryChecklistModalProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Reset checklist when modal opens
  useMemo(() => {
    if (isOpen) {
      setCheckedItems(new Set());
    }
  }, [isOpen]);

  if (!order) return null;

  const allItems = order.itens_pedido;
  const allItemsChecked = checkedItems.size === allItems.length;

  const handleCheck = (itemId: string, checked: boolean) => {
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
      onConfirmDispatch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-primary" /> Conferência de Itens
          </DialogTitle>
          <DialogDescription>
            Confirme se todos os itens do pedido de <span className="font-semibold">{order.delivery_details?.customer?.name || 'Delivery'}</span> estão prontos para despacho.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <ScrollArea className="h-64 border rounded-lg p-4">
            <div className="space-y-3">
              {allItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={checkedItems.has(item.id)}
                      onCheckedChange={(checked) => handleCheck(item.id, checked as boolean)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor={`item-${item.id}`} className="text-base font-medium">
                      {item.quantidade}x {item.nome_produto}
                    </Label>
                  </div>
                  <Badge variant={item.status === 'entregue' ? 'default' : 'warning'} className={cn(item.status === 'entregue' && "bg-green-500 hover:bg-green-600 text-primary-foreground")}>
                    {item.status === 'entregue' ? 'Pronto' : 'Pendente'}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className={cn("p-3 rounded-lg font-bold text-center", allItemsChecked ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300") : "bg-red-100 text-destructive dark:bg-red-900/50 dark:text-red-300")}>
            {allItemsChecked ? "Todos os itens conferidos!" : `Faltam ${allItems.length - checkedItems.size} item(ns) para conferir.`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isSubmitting || !allItemsChecked}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            Confirmar e Despachar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}