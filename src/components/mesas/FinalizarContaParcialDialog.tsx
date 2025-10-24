import { useState, useEffect, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Cliente, ItemPedido } from "@/types/supabase";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

type ItemToPayWithQuantity = {
  id: string;
  quantidade: number;
  isMesaItem: boolean;
};

// Define o tipo esperado para os itens agrupados
type GroupedItemForPayment = ItemPedido & {
  total_quantidade: number;
  subtotal: number;
  original_ids: string[];
};

type FinalizarContaParcialDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
  itensIndividuais: GroupedItemForPayment[]; // Usando o tipo específico
  clientePrincipalId: string | null;
  onConfirm: (itemIdsToPay: ItemToPayWithQuantity[]) => void;
  isSubmitting: boolean;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

export function FinalizarContaParcialDialog({
  isOpen,
  onOpenChange,
  cliente,
  itensIndividuais,
  clientePrincipalId,
  onConfirm,
  isSubmitting,
}: FinalizarContaParcialDialogProps) {
  
  // Os itens a serem pagos são apenas os individuais do cliente
  const itemsToPayWithQuantity: ItemToPayWithQuantity[] = useMemo(() => {
    return itensIndividuais.map(item => ({
      id: item.id,
      quantidade: item.quantidade,
      isMesaItem: false,
    }));
  }, [itensIndividuais]);

  const total = useMemo(() => {
    return itemsToPayWithQuantity.reduce((acc, { id, quantidade }) => {
      const originalItem = itensIndividuais.find(item => item.id === id);
      if (!originalItem) return acc;
      
      // Calcula o preço unitário com desconto
      const precoUnitarioComDesconto = calcularPrecoComDesconto({ ...originalItem, quantidade: 1 });
      return acc + precoUnitarioComDesconto * quantidade;
    }, 0);
  }, [itemsToPayWithQuantity, itensIndividuais]);

  if (!cliente) return null;

  const handleConfirm = () => {
    if (itemsToPayWithQuantity.length > 0) {
      onConfirm(itemsToPayWithQuantity); 
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Conta de {cliente.nome}</AlertDialogTitle>
          <AlertDialogDescription>
            Você está finalizando o pagamento dos itens individuais de {cliente.nome}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* Usando div em vez de aninhar diretamente em AlertDialogDescription */}
        <div className="max-h-60 my-4 pr-2">
          <ScrollArea className="h-full">
            <h4 className="font-semibold mb-2">Itens Individuais ({itensIndividuais.length})</h4>
            <ul className="space-y-1 text-sm mb-4 p-2 border rounded-md bg-secondary">
              {itensIndividuais.map(item => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.nome_produto} (x{item.quantidade})</span>
                  <span>{formatCurrency(calcularPrecoComDesconto(item))}</span>
                </li>
              ))}
            </ul>
            
            {itensIndividuais.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum item individual para pagar.</p>
            )}
          </ScrollArea>
        </div>
        
        <div className="flex justify-between items-center text-lg font-bold pt-4 border-t">
            <span>Total a Pagar:</span>
            <span>{formatCurrency(total)}</span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={isSubmitting || itemsToPayWithQuantity.length === 0}
          >
            {isSubmitting ? "Processando..." : `Confirmar Pagamento (${formatCurrency(total)})`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}