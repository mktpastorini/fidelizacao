import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Mesa } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { ArrowRight, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label"; // IMPORT CORRIGIDO

type TransferClientDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentMesa: Mesa | null;
  ocupantes: Cliente[];
  mesasLivres: Mesa[];
};

export function TransferClientDialog({
  isOpen,
  onOpenChange,
  currentMesa,
  ocupantes,
  mesasLivres,
}: TransferClientDialogProps) {
  const queryClient = useQueryClient();
  const [clienteToTransferId, setClienteToTransferId] = useState<string | null>(null);
  const [newMesaId, setNewMesaId] = useState<string | null>(null);

  const clienteToTransfer = useMemo(() => {
    return ocupantes.find(c => c.id === clienteToTransferId);
  }, [ocupantes, clienteToTransferId]);

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!currentMesa || !clienteToTransferId || !newMesaId) {
        throw new Error("Selecione o cliente e a nova mesa.");
      }

      const { data, error } = await supabase.functions.invoke('transfer-client-to-table', {
        body: {
          current_mesa_id: currentMesa.id,
          new_mesa_id: newMesaId,
          cliente_id: clienteToTransferId,
        },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha na transferência.");
      return data.message;
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", currentMesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["ocupantes"] });
      showSuccess(message);
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleTransfer = () => {
    transferMutation.mutate();
  };

  if (!currentMesa) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Cliente da Mesa {currentMesa.numero}</DialogTitle>
          <DialogDescription>
            Mova um cliente e seus itens individuais para uma nova mesa livre.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="cliente-transfer">Cliente a Transferir</Label>
            <Select 
              value={clienteToTransferId || ''} 
              onValueChange={setClienteToTransferId}
              disabled={transferMutation.isPending}
            >
              <SelectTrigger id="cliente-transfer" className="mt-1">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {ocupantes.map(cliente => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nome} {cliente.id === currentMesa.cliente_id && "(Principal)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nova-mesa">Nova Mesa (Livre)</Label>
            <Select 
              value={newMesaId || ''} 
              onValueChange={setNewMesaId}
              disabled={mesasLivres.length === 0 || transferMutation.isPending}
            >
              <SelectTrigger id="nova-mesa" className="mt-1">
                <SelectValue placeholder="Selecione a mesa de destino" />
              </SelectTrigger>
              <SelectContent>
                {mesasLivres.length > 0 ? (
                  mesasLivres.map(mesa => (
                    <SelectItem key={mesa.id} value={mesa.id}>
                      Mesa {mesa.numero} (Cap: {mesa.capacidade})
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">Nenhuma mesa livre.</div>
                )}
              </SelectContent>
            </Select>
          </div>
          
          {clienteToTransfer && newMesaId && (
            <div className="p-3 border rounded-lg bg-blue-500/10 text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 shrink-0" />
                <p className="text-sm">
                    Transferindo <span className="font-semibold">{clienteToTransfer.nome}</span> para a Mesa {mesasLivres.find(m => m.id === newMesaId)?.numero}.
                </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            onClick={handleTransfer} 
            disabled={!clienteToTransferId || !newMesaId || transferMutation.isPending}
          >
            {transferMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirmar Transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}