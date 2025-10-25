import { useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";

type FinalizarContaParcialDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
  itensIndividuais: (ItemPedido & { subtotal: number, total_quantidade: number })[];
  onConfirm: () => void;
  isSubmitting: boolean;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinalizarContaParcialDialog({
  isOpen,
  onOpenChange,
  cliente,
  itensIndividuais,
  onConfirm,
  isSubmitting,
}: FinalizarContaParcialDialogProps) {
  
  const total = useMemo(() => {
    return itensIndividuais.reduce((acc, item) => acc + item.subtotal, 0);
  }, [itensIndividuais]);

  if (!cliente) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Conta de {cliente.nome}</AlertDialogTitle>
          <AlertDialogDescription>
            Você está finalizando o pagamento de todos os itens individuais de {cliente.nome}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="max-h-60 my-4 pr-2">
          <ScrollArea className="h-full">
            <h4 className="font-semibold mb-2">Itens Individuais ({itensIndividuais.length})</h4>
            {itensIndividuais.length > 0 ? (
              <ul className="space-y-1 text-sm mb-4 p-2 border rounded-md bg-secondary">
                {itensIndividuais.map(item => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.nome_produto} (x{item.total_quantidade})</span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            ) : (
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
            onClick={onConfirm}
            disabled={isSubmitting || itensIndividuais.length === 0}
          >
            {isSubmitting ? "Processando..." : `Confirmar Pagamento (${formatCurrency(total)})`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}