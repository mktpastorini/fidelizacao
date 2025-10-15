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
import { Cliente, Mesa } from "@/types/supabase";
import { useState } from "react";

type ClientArrivalModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
  mesasLivres: Mesa[];
  onAllocateTable: (mesaId: string) => void;
  isAllocating: boolean;
};

export function ClientArrivalModal({
  isOpen,
  onOpenChange,
  cliente,
  mesasLivres,
  onAllocateTable,
  isAllocating,
}: ClientArrivalModalProps) {
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);

  if (!cliente) return null;

  const handleAllocate = () => {
    if (selectedMesaId) {
      onAllocateTable(selectedMesaId);
    }
  };

  const preferences = cliente.gostos ? Object.entries(cliente.gostos).filter(([_, value]) => value) : [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Cliente Reconhecido!</DialogTitle>
          <DialogDescription>
            Boas-vindas de volta, {cliente.nome}!
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="p-4 rounded-lg bg-secondary space-y-2">
            <h3 className="font-bold text-lg text-secondary-foreground">{cliente.nome}</h3>
            {cliente.casado_com && <p className="text-sm text-muted-foreground">Casado(a) com: {cliente.casado_com}</p>}
            
            {preferences.length > 0 && (
                <div className="pt-2">
                    <h4 className="font-semibold text-sm text-secondary-foreground mb-1">Preferências:</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {preferences.map(([key, value]) => (
                        <p key={key}>
                          <span className="capitalize">{key.replace(/_/g, ' ')}:</span> {String(value)}
                        </p>
                      ))}
                    </div>
                </div>
            )}
          </div>
          <div>
            <label htmlFor="mesa-select" className="text-sm font-medium">Alocar à Mesa</label>
            <Select onValueChange={setSelectedMesaId}>
              <SelectTrigger id="mesa-select" className="mt-1">
                <SelectValue placeholder="Selecione uma mesa livre" />
              </SelectTrigger>
              <SelectContent>
                {mesasLivres.length > 0 ? (
                  mesasLivres.map((mesa) => (
                    <SelectItem key={mesa.id} value={mesa.id}>
                      Mesa {mesa.numero} (Capacidade: {mesa.capacidade})
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground">Nenhuma mesa livre.</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleAllocate} disabled={!selectedMesaId || isAllocating}>
            {isAllocating ? "Alocando..." : "Confirmar Alocação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}