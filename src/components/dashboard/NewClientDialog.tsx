import { ClienteForm } from "@/components/clientes/ClienteForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Cliente } from "@/types/supabase";

type NewClientDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: any) => void;
  isSubmitting: boolean;
  clientes: Cliente[];
};

export function NewClientDialog({ isOpen, onOpenChange, onSubmit, isSubmitting, clientes }: NewClientDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          <DialogDescription>
            Adicione uma ou mais fotos para o reconhecimento e preencha as informações.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          <ClienteForm 
            onSubmit={onSubmit} 
            isSubmitting={isSubmitting} 
            clientes={clientes} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}