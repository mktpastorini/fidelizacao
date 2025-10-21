import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pedido, ItemPedido } from "@/types/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DetalhesPedidoModal } from "@/components/historico/DetalhesPedidoModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePageActions } from "@/contexts/PageActionsContext";
import React from "react";

type PedidoComClienteEItens = Pedido & {
  cliente: { nome: string } | null;
  itens_pedido: ItemPedido[];
};

async function fetchPedidosPagos(): Promise<PedidoComClienteEItens[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, cliente:clientes(nome), itens_pedido(*)")
    .eq("status", "pago")
    .order("closed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as PedidoComClienteEItens[]) || [];
}

export default function HistoricoPage() {
  const { setPageActions } = usePageActions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<PedidoComClienteEItens | null>(null);

  const { data: pedidos, isLoading, isError } = useQuery({
    queryKey: ["pedidosPagos"],
    queryFn: fetchPedidosPagos,
  });

  const handleVerDetalhes = (pedido: PedidoComClienteEItens) => {
    setSelectedPedido(pedido);
    setIsModalOpen(true);
  };

  const calculateTotal = (itens: ItemPedido[]) => {
    return itens.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0);
  };

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Define os botões específicos da página para o cabeçalho
  useEffect(() => {
    const pageButtons = (
      <div className="flex items-center gap-2">
        {/* No histórico, não há botões específicos no cabeçalho */}
      </div>
    );
    setPageActions(pageButtons);

    return () => setPageActions(null); // Clean up on unmount
  }, [setPageActions]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Histórico de Pedidos</h1>
        <p className="text-muted-foreground mt-2">Consulte todos os pedidos que já foram finalizados.</p>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        {isLoading ? <p>Carregando histórico...</p> : isError ? <p className="text-destructive">Erro ao carregar o histórico.</p> : pedidos && pedidos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell>
                    {pedido.closed_at ? format(new Date(pedido.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'N/A'}
                  </TableCell>
                  <TableCell>{pedido.cliente?.nome || "Não identificado"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(calculateTotal(pedido.itens_pedido))}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => handleVerDetalhes(pedido)}>
                      Ver Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum pedido finalizado encontrado.</p>
          </div>
        )}
      </div>

      <DetalhesPedidoModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        pedido={selectedPedido}
      />
    </div>
  );
}