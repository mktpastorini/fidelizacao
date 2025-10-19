import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido, Cliente, Pedido } from "@/types/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign } from "lucide-react";

type PedidoComItens = Pedido & { itens_pedido: ItemPedido[] };

async function fetchOrderData(mesaId: string): Promise<{ pedido: PedidoComItens | null, ocupantes: Cliente[] }> {
  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .order("created_at", { foreignTable: "itens_pedido", ascending: true })
    .maybeSingle();

  if (pedidoError) throw new Error(pedidoError.message);

  let ocupantes: Cliente[] = [];
  if (pedido) {
    const { data: ocupanteIds, error: idsError } = await supabase.from("mesa_ocupantes").select("cliente_id").eq("mesa_id", mesaId);
    if (idsError) throw idsError;

    const ids = ocupanteIds.map(o => o.cliente_id);
    if (ids.length > 0) {
      const { data: clientes, error: clientesError } = await supabase.from("clientes").select("id, nome").in("id", ids);
      if (clientesError) throw clientesError;
      ocupantes = clientes;
    }
  }

  return { pedido: pedido as PedidoComItens | null, ocupantes };
}

type PublicOrderSummaryProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesaId: string;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PublicOrderSummary({ isOpen, onOpenChange, mesaId }: PublicOrderSummaryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["publicOrderSummary", mesaId],
    queryFn: () => fetchOrderData(mesaId),
    enabled: isOpen,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  const ocupantesMap = new Map(data?.ocupantes.map(o => [o.id, o.nome]));
  ocupantesMap.set('mesa', 'Mesa (Geral)');

  const totalPedido = data?.pedido?.itens_pedido.reduce((acc, item) => {
    const precoTotal = (item.preco || 0) * item.quantidade;
    const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
    return acc + (precoTotal - desconto);
  }, 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Sua Comanda</DialogTitle>
          <DialogDescription>Itens adicionados ao pedido da mesa.</DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : data?.pedido?.itens_pedido.length ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead>Consumidor</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pedido.itens_pedido.map((item) => {
                  const precoFinal = (item.preco || 0) * item.quantidade * (1 - (item.desconto_percentual || 0) / 100);
                  const consumidorNome = item.consumido_por_cliente_id 
                    ? ocupantesMap.get(item.consumido_por_cliente_id) 
                    : ocupantesMap.get('mesa');

                  return (
                    <TableRow key={item.id} className="text-sm">
                      <TableCell className="font-medium">{item.nome_produto}</TableCell>
                      <TableCell className="text-center">{item.quantidade}</TableCell>
                      <TableCell className="text-xs text-gray-600">{consumidorNome}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(precoFinal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <span className="text-lg font-bold flex items-center gap-2"><DollarSign className="w-5 h-5" /> Total Parcial:</span>
              <span className="text-2xl font-extrabold">{formatCurrency(totalPedido)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            <p>Nenhum item adicionado à comanda ainda.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}