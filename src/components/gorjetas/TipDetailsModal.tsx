import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

type TipDetail = {
  id: string;
  cliente_nome: string;
  valor: number;
  data: string;
};

type TipDetailsModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  garcomNome: string;
  tipDetails: TipDetail[];
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TipDetailsModal({ isOpen, onOpenChange, garcomNome, tipDetails }: TipDetailsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes das Gorjetas de {garcomNome}</DialogTitle>
          <DialogDescription>
            Lista de gorjetas recebidas por {garcomNome}.
          </DialogDescription>
        </DialogHeader>
        {tipDetails.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma gorjeta registrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tipDetails.map((tip) => (
                <TableRow key={tip.id}>
                  <TableCell>{tip.cliente_nome}</TableCell>
                  <TableCell>{format(new Date(tip.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(tip.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}