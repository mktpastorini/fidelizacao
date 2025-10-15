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

type FinalizarContaParcialDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
  itens: ItemPedido[];
  onConfirm: () => void;
  isSubmitting: boolean;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinalizarContaParcialDialog({
  isOpen,
  onOpenChange,
  cliente,
  itens,
  onConfirm,
  isSubmitting,
}: FinalizarContaParcialDialogProps) {
  if (!cliente) return null;

  const total = itens.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0);

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Conta de {cliente.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso irá registrar o pagamento dos itens de {cliente.nome} e removê-lo da mesa. O valor total é de {formatCurrency(total)}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-60 overflow-y-auto my-4 pr-2">
          <h4 className="font-semibold mb-2">Itens a serem pagos:</h4>
          <ul className="space-y-1 text-sm">
            {itens.map(item => (
              <li key={item.id} className="flex justify-between">
                <span>{item.nome_produto} (x{item.quantidade})</span>
                <span>{formatCurrency((item.preco || 0) * item.quantidade)}</span>
              </li>
            ))}
          </ul>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Processando..." : "Confirmar Pagamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}