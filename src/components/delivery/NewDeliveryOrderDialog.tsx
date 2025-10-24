import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DeliveryOrderForm } from "./DeliveryOrderForm";
import { Cliente, Produto } from "@/types/supabase";
import { Skeleton } from "../ui/skeleton";

type NewDeliveryOrderDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clientes: Cliente[] | undefined;
  produtos: Produto[] | undefined;
  onSubmit: (values: any) => void;
  isSubmitting: boolean;
};

export function NewDeliveryOrderDialog({
  isOpen,
  onOpenChange,
  clientes,
  produtos,
  onSubmit,
  isSubmitting,
}: NewDeliveryOrderDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Delivery</DialogTitle>
          <DialogDescription>
            Selecione o cliente, confirme o endereço e adicione os itens.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          {!clientes || !produtos ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DeliveryOrderForm
              clientes={clientes}
              produtos={produtos}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}