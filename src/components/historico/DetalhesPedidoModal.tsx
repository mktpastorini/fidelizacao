import { Pedido, ItemPedido } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users } from "lucide-react";

type DetalhesPedidoModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  pedido: (Pedido & { cliente: { nome: string } | null, itens_pedido: ItemPedido[] }) | null;
};

export function DetalhesPedidoModal({ isOpen, onOpenChange, pedido }: DetalhesPedidoModalProps) {
  if (!pedido) return null;

  const totalPedido = pedido.itens_pedido.reduce((acc, item) => {
    return acc + (item.preco || 0) * item.quantidade;
  }, 0);

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido</DialogTitle>
          <DialogDescription>
            Pedido fechado em {pedido.closed_at ? format(new Date(pedido.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p><strong>Cliente:</strong> {pedido.cliente?.nome || "Não identificado"}</p>
          
          {pedido.acompanhantes && pedido.acompanhantes.length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <Users className="w-4 h-4 mt-1 text-gray-600" />
              <div>
                <strong className="font-semibold">Acompanhantes:</strong>
                <span className="text-gray-700 ml-1">{pedido.acompanhantes.map(a => a.nome).join(', ')}</span>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-semibold mb-2">Itens Consumidos</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedido.itens_pedido.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nome_produto}</TableCell>
                    <TableCell className="text-center">{item.quantidade}</TableCell>
                    <TableCell className="text-right">{formatCurrency((item.preco || 0) * item.quantidade)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total do Pedido:</span>
              <span>{formatCurrency(totalPedido)}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}