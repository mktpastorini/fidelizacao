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
import { Button } from "@/components/ui/button"; // Importação adicionada
import { Input } from "@/components/ui/input"; // Input também é usado
import { Minus, Plus } from "lucide-react"; // Ícones também são usados

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
  
  // Novo estado para gerenciar a quantidade a ser paga por item da mesa
  const [mesaItemQuantities, setMesaItemQuantities] = useState<Record<string, number>>({});

  const isClientePrincipal = cliente?.id === clientePrincipalId;
  
  // Inicializa a seleção de itens da mesa (sempre vazia no início, exceto pelos itens individuais)
  useEffect(() => {
    if (isOpen) {
      setSelectedMesaItemIds([]);
      
      // Inicializa as quantidades para os itens da mesa (padrão: 1)
      const initialQuantities: Record<string, number> = {};
      itensMesaGeral.forEach(item => {
        initialQuantities[item.id] = item.quantidade; // Inicialmente, a quantidade máxima
      });
      setMesaItemQuantities(initialQuantities);
    }
  }, [isOpen, itensMesaGeral]);

  const allItemsToDisplay = useMemo(() => [
    ...itensIndividuais.map(item => ({ ...item, isMesaItem: false })),
    ...itensMesaGeral.map(item => ({ ...item, isMesaItem: true })),
  ], [itensIndividuais, itensMesaGeral]);

  // Calcula os itens a serem pagos, incluindo a quantidade parcial
  const itemsToPayWithQuantity = useMemo(() => {
    const individualItems = itensIndividuais.map(item => ({
      id: item.id,
      quantidade: item.quantidade,
      isMesaItem: false,
    }));

    const mesaItems = itensMesaGeral
      .filter(item => selectedMesaItemIds.includes(item.id))
      .map(item => ({
        id: item.id,
        quantidade: mesaItemQuantities[item.id] || 0,
        isMesaItem: true,
      }))
      .filter(item => item.quantidade > 0);

    return [...individualItems, ...mesaItems];
  }, [itensIndividuais, itensMesaGeral, selectedMesaItemIds, mesaItemQuantities]);

  const total = useMemo(() => {
    return itemsToPayWithQuantity.reduce((acc, { id, quantidade }) => {
      const originalItem = allItemsToDisplay.find(item => item.id === id);
      if (!originalItem) return acc;
      
      // Calcula o preço unitário com desconto
      const precoUnitarioComDesconto = calcularPrecoComDesconto({ ...originalItem, quantidade: 1 });
      return acc + precoUnitarioComDesconto * quantidade;
    }, 0);
  }, [itemsToPayWithQuantity, allItemsToDisplay]);

  if (!cliente) return null;

  const handleToggleMesaItem = (itemId: string, isChecked: boolean) => {
    setSelectedMesaItemIds(prev => 
      isChecked ? [...prev, itemId] : prev.filter(id => id !== itemId)
    );
  };
  
  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    const originalItem = itensMesaGeral.find(item => item.id === itemId);
    if (!originalItem) return;

    const maxQuantity = originalItem.quantidade;
    const clampedQuantity = Math.max(1, Math.min(maxQuantity, newQuantity));

    setMesaItemQuantities(prev => ({
      ...prev,
      [itemId]: clampedQuantity,
    }));
  };

  const handleConfirm = () => {
    if (itemsToPayWithQuantity.length > 0) {
      // Em vez de passar apenas IDs, passamos um objeto com ID e quantidade
      onConfirm(itemsToPayWithQuantity as any); 
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Conta de {cliente.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            Selecione os itens da Mesa (Geral) que você deseja pagar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <ScrollArea className="max-h-60 my-4 pr-2">
          <h4 className="font-semibold mb-2">Itens Individuais ({itensIndividuais.length})</h4>
          <ul className="space-y-1 text-sm mb-4 p-2 border rounded-md bg-secondary">
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
              </h4>
              <ul className="space-y-2 text-sm">
                {itensMesaGeral.map(item => {
                  const isSelected = selectedMesaItemIds.includes(item.id);
                  const currentQuantity = mesaItemQuantities[item.id] || 0;
                  const precoUnitario = calcularPrecoComDesconto({ ...item, quantidade: 1 });
                  
                  return (
                    <li key={item.id} className={cn("flex justify-between items-center p-2 rounded-md bg-secondary", isSelected && "border border-primary/50")}>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`mesa-item-${item.id}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => handleToggleMesaItem(item.id, !!checked)}
                        />
                        <Label htmlFor={`mesa-item-${item.id}`} className="font-normal cursor-pointer">
                          {item.nome_produto} (Total: x{item.quantidade})
                        </Label>
                      </div>
                      
                      {isSelected ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-1">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(item.id, currentQuantity - 1)} 
                              disabled={currentQuantity <= 1 || isSubmitting}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input 
                              type="number" 
                              min="1" 
                              max={item.quantidade}
                              value={currentQuantity} 
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)} 
                              className="w-10 text-center h-6 p-0 text-xs"
                              disabled={isSubmitting}
                            />
                            <Button 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => handleQuantityChange(item.id, currentQuantity + 1)} 
                              disabled={currentQuantity >= item.quantidade || isSubmitting}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <span className="font-semibold w-20 text-right">{formatCurrency(precoUnitario * currentQuantity)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{formatCurrency(calcularPrecoComDesconto(item))}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          
          {itemsToPayWithQuantity.length === 0 && (
            <p className="text-center text-muted-foreground py-4">Nenhum item para pagar.</p>
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
            disabled={isSubmitting || itemsToPayWithQuantity.length === 0}
          >
            {isSubmitting ? "Processando..." : `Confirmar Pagamento (${formatCurrency(total)})`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}