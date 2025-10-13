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
import { Badge } from "../ui/badge";

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cliente Reconhecido!</DialogTitle>
          <DialogDescription>
            Boas-vindas de volta, {cliente.nome}!
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="p-4 border rounded-lg bg-gray-50/50">
            <h3 className="font-semibold text-lg mb-2">{cliente.nome}</h3>
            {cliente.casado_com && <p className="text-sm text-gray-600">Casado(a) com: {cliente.casado_com}</p>}
            {cliente.filhos && cliente.filhos.length > 0 && (
              <div className="mt-2">
                <h4 className="font-medium text-sm">Filhos:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {cliente.filhos.map(filho => (
                    <li key={filho.id}>{filho.nome} ({filho.idade || '?'} anos)</li>
                  ))}
                </ul>
              </div>
            )}
            {cliente.gostos && (
                <div className="mt-2">
                    <h4 className="font-medium text-sm">Preferências:</h4>
                    <pre className="text-xs bg-gray-100 p-2 rounded-md whitespace-pre-wrap font-sans">{JSON.stringify(cliente.gostos, null, 2)}</pre>
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
                  <div className="p-2 text-sm text-gray-500">Nenhuma mesa livre.</div>
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