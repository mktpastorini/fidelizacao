import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Cliente } from "@/types/supabase";
import { useState } from "react";

type AssignClienteDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clientes: Pick<Cliente, 'id' | 'nome'>[];
  onSubmit: (clienteId: string) => void;
  isSubmitting: boolean;
};

export function AssignClienteDialog({
  isOpen,
  onOpenChange,
  clientes,
  onSubmit,
  isSubmitting,
}: AssignClienteDialogProps) {
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedClienteId) {
      onSubmit(selectedClienteId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ocupar Mesa</DialogTitle>
          <DialogDescription>
            Selecione um cliente para associar a esta mesa.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select onValueChange={setSelectedClienteId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedClienteId || isSubmitting}>
            {isSubmitting ? "Associando..." : "Associar Cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}