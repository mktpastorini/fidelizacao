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
import { ItemPedido, StaffProfile } from "@/types/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { showError } from "@/utils/toast";

type FinalizarContaTotalDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  itensRestantes: ItemPedido[];
  staffProfiles: StaffProfile[];
  onConfirm: (gorjetaValor: number, garcomId: string) => void;
  isSubmitting: boolean;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

export function FinalizarContaTotalDialog({
  isOpen,
  onOpenChange,
  itensRestantes,
  staffProfiles,
  onConfirm,
  isSubmitting,
}: FinalizarContaTotalDialogProps) {
  const [selectedGarcomId, setSelectedGarcomId] = useState<string | null>(null);
  const [tipEnabled, setTipEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (staffProfiles.length > 0) {
        setSelectedGarcomId(staffProfiles[0].id);
      }
    }
  }, [isOpen, staffProfiles]);

  // Subtotal de TODOS os itens restantes
  const subtotalItens = useMemo(() => {
    return itensRestantes.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
  }, [itensRestantes]);

  // Gorjeta (10% do subtotal total)
  const gorjetaValor = tipEnabled ? subtotalItens * 0.1 : 0;
  
  // Total final
  const totalAPagar = subtotalItens + gorjetaValor;

  const handleConfirm = () => {
    if (itensRestantes.length === 0) {
      showError("Nenhum item restante para pagar.");
      return;
    }
    if (tipEnabled && !selectedGarcomId) {
      showError("Selecione o garçom para aplicar a gorjeta.");
      return;
    }
    
    onConfirm(gorjetaValor, selectedGarcomId!); 
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar Conta Total</AlertDialogTitle>
          <AlertDialogDescription>
            O cliente principal está finalizando o pagamento de todos os itens restantes da mesa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="max-h-60 my-4 pr-2">
          <ScrollArea className="h-full">
            <h4 className="font-semibold mb-2">Itens Restantes ({itensRestantes.length})</h4>
            <ul className="space-y-1 text-sm mb-4 p-2 border rounded-md bg-secondary">
              {itensRestantes.map(item => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.nome_produto} (x{item.quantidade})</span>
                  <span>{formatCurrency(calcularPrecoComDesconto(item))}</span>
                </li>
              ))}
            </ul>
            
            {itensRestantes.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum item restante para pagar.</p>
            )}
          </ScrollArea>
        </div>
        
        <div className="space-y-3 pt-4 border-t">
            {/* Seletor de Garçom */}
            <div>
                <Label htmlFor="garcom-select" className="text-sm font-medium">Garçom (para gorjeta)</Label>
                <Select 
                    value={selectedGarcomId || ''} 
                    onValueChange={setSelectedGarcomId}
                    disabled={staffProfiles.length === 0 || isSubmitting}
                >
                    <SelectTrigger id="garcom-select" className="mt-1">
                        <SelectValue placeholder="Selecione o garçom" />
                    </SelectTrigger>
                    <SelectContent>
                        {staffProfiles.map(staff => (
                            <SelectItem key={staff.id} value={staff.id}>
                                {staff.first_name} {staff.last_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            {/* Toggle Gorjeta */}
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <Label htmlFor="tip-toggle">Incluir Gorjeta (10%)</Label>
                <Switch id="tip-toggle" checked={tipEnabled} onCheckedChange={setTipEnabled} disabled={isSubmitting} />
            </div>

            {/* Resumo Financeiro */}
            <div className="space-y-1">
                <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotalItens)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Gorjeta ({tipEnabled ? '10%' : '0%'}):</span>
                    <span className={cn("font-medium", tipEnabled ? "text-green-600" : "text-muted-foreground")}>{formatCurrency(gorjetaValor)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                    <span>Total a Pagar:</span>
                    <span>{formatCurrency(totalAPagar)}</span>
                </div>
            </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={isSubmitting || itensRestantes.length === 0 || (tipEnabled && !selectedGarcomId)}
          >
            {isSubmitting ? "Processando..." : `Confirmar Pagamento Total (${formatCurrency(totalAPagar)})`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}