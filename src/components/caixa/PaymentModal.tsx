import { useMemo } from "react";
import { Cliente, ItemPedido } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Star, DollarSign, Users } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";

type PaymentModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
  tableData: {
    mesa_id: string;
    mesa_numero: number;
    pedido: {
      id: string;
      itens_pedido: ItemPedido[];
    };
    ocupantes: { id: string; nome: string }[];
  } | null;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

export function PaymentModal({ isOpen, onOpenChange, cliente, tableData }: PaymentModalProps) {
  const { itensCliente, itensOutros, totalCliente, totalOutros } = useMemo(() => {
    if (!cliente || !tableData?.pedido?.itens_pedido) {
      return { itensCliente: [], itensOutros: [], totalCliente: 0, totalOutros: 0 };
    }

    const itensCliente: ItemPedido[] = [];
    const itensOutros: ItemPedido[] = [];

    tableData.pedido.itens_pedido.forEach(item => {
      if (item.consumido_por_cliente_id === cliente.id) {
        itensCliente.push(item);
      } else {
        itensOutros.push(item);
      }
    });

    const totalCliente = itensCliente.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
    const totalOutros = itensOutros.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);

    return { itensCliente, itensOutros, totalCliente, totalOutros };
  }, [cliente, tableData]);

  if (!cliente || !tableData) return null;

  const ocupantesMap = new Map(tableData.ocupantes.map(o => [o.id, o.nome]));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4 ring-2 ring-primary ring-offset-4 ring-offset-card">
            <AvatarImage src={cliente.avatar_url || undefined} />
            <AvatarFallback><User className="w-12 h-12" /></AvatarFallback>
          </Avatar>
          <DialogTitle className="text-2xl">{cliente.nome}</DialogTitle>
          <DialogDescription>
            Mesa {tableData.mesa_numero} - Pontos: {cliente.pontos}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="space-y-6">
            {/* Itens do Cliente */}
            <div>
              <h3 className="font-semibold mb-2">Comanda de {cliente.nome}</h3>
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {itensCliente.length > 0 ? itensCliente.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.quantidade}x {item.nome_produto}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calcularPrecoComDesconto(item))}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nenhum item individual.</TableCell></TableRow>}
                </TableBody>
              </Table>
              <p className="text-right font-bold mt-2">Subtotal: {formatCurrency(totalCliente)}</p>
            </div>

            {/* Itens dos Outros */}
            {itensOutros.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Restante da Mesa</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Consumidor</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {itensOutros.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.quantidade}x {item.nome_produto}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ocupantesMap.get(item.consumido_por_cliente_id!) || 'Mesa'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(calcularPrecoComDesconto(item))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-right font-bold mt-2">Subtotal: {formatCurrency(totalOutros)}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center pt-4 border-t">
          <div className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Total da Mesa: {formatCurrency(totalCliente + totalOutros)}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}