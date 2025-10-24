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
  onConfirm: (itemIdsToPay: string[]) => void; // Agora recebe apenas os IDs originais
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
  
  // Coleta todos os IDs originais de todos os itens agrupados
  const allOriginalItemIds: string[] = useMemo(() => {
    return itensIndividuais.flatMap(item => item.original_ids);
  }, [itensIndividuais]);

  const total = useMemo(() => {
    return itensIndividuais.reduce((acc, item) => acc + item.subtotal, 0);
  }, [itensIndividuais]);

  if (!cliente) return null;

  const handleConfirm = () => {
    if (allOriginalItemIds.length > 0) {
      onConfirm(allOriginalItemIds); 
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
        
        <div className="max-h-60 my-4 pr-2">
          <ScrollArea className="h-full">
            <h4 className="font-semibold mb-2">Itens Individuais ({itensIndividuais.length})</h4>
            <ul className="space-y-1 text-sm mb-4 p-2 border rounded-md bg-secondary">
              {itensIndividuais.map(item => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.nome_produto} (x{item.total_quantidade})</span>
                  <span>{formatCurrency(item.subtotal)}</span>
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
            disabled={isSubmitting || allOriginalItemIds.length === 0}
          >
            {isSubmitting ? "Processando..." : `Confirmar Pagamento (${formatCurrency(total)})`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}