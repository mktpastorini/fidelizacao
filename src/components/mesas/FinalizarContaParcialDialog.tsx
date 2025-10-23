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

type FinalizarContaParcialDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
  itensIndividuais: ItemPedido[];
  itensMesaGeral: ItemPedido[];
  clientePrincipalId: string | null;
  onConfirm: (itemIdsToPay: string[]) => void;
  isSubmitting: boolean;
  isPartialDialogValid: boolean;
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
  itensMesaGeral,
  clientePrincipalId,
  onConfirm,
  isSubmitting,
  isPartialDialogValid,
}: FinalizarContaParcialDialogProps) {
  // Hooks devem ser chamados no topo
  const [selectedMesaItemIds, setSelectedMesaItemIds] = useState<string[]>([]);
  
  const isClientePrincipal = cliente?.id === clientePrincipalId;
  
  // Inicializa a seleção de itens da mesa (apenas se for o cliente principal)
  useEffect(() => {
    if (isOpen) {
      if (isClientePrincipal) {
        // Se for o principal, seleciona todos os itens da mesa por padrão
        setSelectedMesaItemIds(itensMesaGeral.map(item => item.id));
      } else {
        // Acompanhantes não podem pagar pelos itens da mesa por padrão
        setSelectedMesaItemIds([]);
      }
    }
  }, [isOpen, isClientePrincipal, itensMesaGeral]);

  const allItemsToDisplay = useMemo(() => [
    ...itensIndividuais.map(item => ({ ...item, isMesaItem: false })),
    ...itensMesaGeral.map(item => ({ ...item, isMesaItem: true })),
  ], [itensIndividuais, itensMesaGeral]);

  const finalItemIdsToPay = useMemo(() => {
    const individualIds = itensIndividuais.map(item => item.id);
    // Apenas o cliente principal pode selecionar itens da mesa.
    // Se não for o principal, selectedMesaItemIds deve ser vazio, mas incluímos aqui para segurança.
    return [...individualIds, ...selectedMesaItemIds];
  }, [itensIndividuais, selectedMesaItemIds]);

  const total = useMemo(() => {
    return allItemsToDisplay
      .filter(item => !item.isMesaItem || finalItemIdsToPay.includes(item.id))
      .reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
  }, [allItemsToDisplay, finalItemIdsToPay]);

  if (!cliente) return null;

  const handleToggleMesaItem = (itemId: string, isChecked: boolean) => {
    // Permite que qualquer cliente pague pelos itens da mesa, se selecionados.
    // A regra de quem pode selecionar é definida pelo usuário no frontend.
    setSelectedMesaItemIds(prev => 
      isChecked ? [...prev, itemId] : prev.filter(id => id !== itemId)
    );
  };

  const handleConfirm = () => {
    if (finalItemIdsToPay.length > 0) {
      onConfirm(finalItemIdsToPay);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Conta de {cliente.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso irá registrar o pagamento dos itens selecionados e removê-lo da mesa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <ScrollArea className="max-h-60 my-4 pr-2">
          <h4 className="font-semibold mb-2">Itens Individuais ({itensIndividuais.length})</h4>
          <ul className="space-y-1 text-sm mb-4">
            {itensIndividuais.map(item => (
              <li key={item.id} className="flex justify-between">
                <span>{item.nome_produto} (x{item.quantidade})</span>
                <span>{formatCurrency(calcularPrecoComDesconto(item))}</span>
              </li>
            ))}
          </ul>
          
          {itensMesaGeral.length > 0 && (
            <>
              <h4 className="font-semibold mb-2 flex items-center justify-between">
                Itens da Mesa (Geral) ({itensMesaGeral.length})
                <Label className="text-xs text-muted-foreground">
                    (Selecione quais deseja incluir)
                </Label>
              </h4>
              <ul className="space-y-2 text-sm">
                {itensMesaGeral.map(item => (
                  <li key={item.id} className={cn("flex justify-between items-center p-2 rounded-md bg-secondary")}>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`mesa-item-${item.id}`}
                        checked={selectedMesaItemIds.includes(item.id)}
                        onCheckedChange={(checked) => handleToggleMesaItem(item.id, !!checked)}
                      />
                      <Label htmlFor={`mesa-item-${item.id}`} className="font-normal cursor-pointer">
                        {item.nome_produto} (x{item.quantidade})
                      </Label>
                    </div>
                    <span>{formatCurrency(calcularPrecoComDesconto(item))}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ScrollArea>
        
        <div className="flex justify-between items-center text-lg font-bold pt-4 border-t">
            <span>Total a Pagar:</span>
            <span>{formatCurrency(total)}</span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={isSubmitting || finalItemIdsToPay.length === 0}
          >
            {isSubmitting ? "Processando..." : `Confirmar Pagamento (${formatCurrency(total)})`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}