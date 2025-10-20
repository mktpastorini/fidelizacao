import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Produto, ItemPedido } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/utils/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Utensils, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { FinalizarContaParcialDialog } from "./FinalizarContaParcialDialog";
import { AplicarDescontoDialog } from "./AplicarDescontoDialog";
import { Cliente } from "@/types/supabase";

const itemSchema = z.object({
  nome_produto: z.string().min(2, "O nome do produto é obrigatório."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  preco: z.coerce.number(),
  consumido_por_cliente_id: z.string().uuid().nullable().optional(),
  status: z.enum(['pendente', 'preparando', 'entregue']),
  requer_preparo: z.boolean(),
});

type PedidoModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesa: any; // TODO: Use a more specific type for mesa
};

type PedidoComItensEClientes = {
  id: string;
  cliente_id: string | null;
  status: string;
  created_at: string;
  acompanhantes: Cliente[];
  itens_pedido: (ItemPedido & { cliente: { nome: string } | null })[];
};

async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchPedidoAberto(mesaId: string): Promise<PedidoComItensEClientes | null> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      id,
      cliente_id,
      status,
      created_at,
      acompanhantes,
      itens_pedido(*, cliente:clientes(nome))
    `)
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .order("created_at", { foreignTable: "itens_pedido", ascending: true })
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data as PedidoComItensEClientes | null;
}

async function fetchClientesDaMesa(mesaId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("mesa_ocupantes")
    .select("cliente:clientes(id, nome)")
    .eq("mesa_id", mesaId);
  if (error) throw error;
  return data.map(o => o.cliente).filter(Boolean) as Cliente[];
}

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  const queryClient = useQueryClient();
  const [isFinalizarParcialOpen, setIsFinalizarParcialOpen] = useState(false);
  const [clientePagando, setClientePagando] = useState<Cliente | null>(null);
  const [itensDoClientePagando, setItensDoClientePagando] = useState<ItemPedido[]>([]);
  const [isDescontoOpen, setIsDescontoOpen] = useState(false);
  const [itemParaDesconto, setItemParaDesconto] = useState<ItemPedido | null>(null);

  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: fetchProdutos,
    enabled: isOpen,
  });

  const { data: pedidoAberto, isLoading: isLoadingPedido } = useQuery({
    queryKey: ["pedidoAberto", mesa?.id],
    queryFn: () => fetchPedidoAberto(mesa!.id),
    enabled: isOpen && !!mesa?.id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: clientesNaMesa } = useQuery({
    queryKey: ["clientesNaMesa", mesa?.id],
    queryFn: () => fetchClientesDaMesa(mesa!.id),
    enabled: isOpen && !!mesa?.id,
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: Omit<ItemPedido, 'id' | 'created_at' | 'updated_at' | 'pedido_id' | 'user_id'>) => {
      if (!mesa?.id || !pedidoAberto?.id) throw new Error("Mesa ou pedido não identificados.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("itens_pedido").insert({
        ...item,
        pedido_id: pedidoAberto.id,
        user_id: user.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      showSuccess("Item adicionado ao pedido!");
      form.reset({ nome_produto: "", quantidade: 1, preco: 0, consumido_por_cliente_id: null, status: "pendente", requer_preparo: true });
    },
    onError: (err: Error) => showError(err.message),
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: 'pendente' | 'preparando' | 'entregue' }) => {
      const { error } = await supabase.from("itens_pedido").update({ status: newStatus }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      showSuccess("Status do item atualizado!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("itens_pedido").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      showSuccess("Item removido do pedido!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const finalizarPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!pedidoAberto?.id) throw new Error("Nenhum pedido aberto para finalizar.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("pedidos")
        .update({ status: "pago", closed_at: new Date().toISOString() })
        .eq("id", pedidoAberto.id);
      if (error) throw new Error(error.message);

      // Enviar mensagem de pagamento se configurado
      if (pedidoAberto.cliente_id) {
        const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', {
          body: { clientId: pedidoAberto.cliente_id, userId: user.id },
        });
        if (functionError) {
          showError(`Pedido finalizado, mas falha ao enviar mensagem de pagamento: ${functionError.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["historicoCliente"] });
      queryClient.invalidateQueries({ queryKey: ["pedidosPagos"] });
      showSuccess("Pedido finalizado com sucesso!");
      onOpenChange(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const finalizarPagamentoParcialMutation = useMutation({
    mutationFn: async () => {
      if (!pedidoAberto?.id || !clientePagando?.id) throw new Error("Pedido ou cliente não identificados para pagamento parcial.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { error: rpcError } = await supabase.rpc('finalizar_pagamento_parcial', {
        p_pedido_id: pedidoAberto.id,
        p_cliente_id_pagando: clientePagando.id,
      });
      if (rpcError) throw new Error(rpcError.message);

      // Enviar mensagem de pagamento se configurado
      const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', {
        body: { clientId: clientePagando.id, userId: user.id },
      });
      if (functionError) {
        showError(`Pagamento parcial finalizado, mas falha ao enviar mensagem de pagamento: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["historicoCliente"] });
      queryClient.invalidateQueries({ queryKey: ["pedidosPagos"] });
      showSuccess(`Pagamento de ${clientePagando?.nome} finalizado com sucesso!`);
      setIsFinalizarParcialOpen(false);
      setClientePagando(null);
      setItensDoClientePagando([]);
    },
    onError: (err: Error) => showError(err.message),
  });

  const aplicarDescontoMutation = useMutation({
    mutationFn: async ({ itemId, percentual, motivo }: { itemId: string; percentual: number; motivo?: string }) => {
      const { error } = await supabase
        .from("itens_pedido")
        .update({ desconto_percentual: percentual, desconto_motivo: motivo })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      showSuccess("Desconto aplicado com sucesso!");
      setIsDescontoOpen(false);
      setItemParaDesconto(null);
    },
    onError: (err: Error) => showError(err.message),
  });

  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      nome_produto: "",
      quantidade: 1,
      preco: 0,
      consumido_por_cliente_id: null,
      status: "pendente",
      requer_preparo: true,
    },
  });

  const selectedProduto = produtos?.find(p => p.nome === form.watch("nome_produto"));

  const handleProductSelect = (productName: string) => {
    form.setValue("nome_produto", productName);
    const prod = produtos?.find(p => p.nome === productName);
    if (prod) {
      form.setValue("preco", prod.preco);
      form.setValue("requer_preparo", prod.requer_preparo);
      // Determine initial status based on product type
      if (prod.tipo === 'rodizio') {
        form.setValue("status", "entregue"); // Rodizio items are immediately delivered
      } else {
        form.setValue("status", "pendente"); // Other items need prep
      }
    }
  };

  const onSubmit = (values: z.infer<typeof itemSchema>) => {
    addItemMutation.mutate(values);
  };

  const totalPedido = pedidoAberto?.itens_pedido.reduce((acc, item) => {
    const precoTotal = (item.preco || 0) * item.quantidade;
    const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
    return acc + (precoTotal - desconto);
  }, 0) || 0;

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleFinalizarParcialClick = (cliente: Cliente) => {
    setClientePagando(cliente);
    const itensDoCliente = pedidoAberto?.itens_pedido.filter(item => item.consumido_por_cliente_id === cliente.id) || [];
    setItensDoClientePagando(itensDoCliente);
    setIsFinalizarParcialOpen(true);
  };

  const handleAplicarDescontoClick = (item: ItemPedido) => {
    setItemParaDesconto(item);
    setIsDescontoOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pedido da Mesa {mesa?.numero}</DialogTitle>
          <DialogDescription>
            Gerencie os itens do pedido e finalize a conta.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 pr-2 space-y-6">
          {isLoadingPedido ? (
            <p>Carregando pedido...</p>
          ) : !pedidoAberto ? (
            <p className="text-center text-muted-foreground">Nenhum pedido aberto para esta mesa.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <p>Iniciado em: {format(new Date(pedidoAberto.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                <p>Cliente Principal: {clientesNaMesa?.find(c => c.id === pedidoAberto.cliente_id)?.nome || "N/A"}</p>
              </div>

              {pedidoAberto.acompanhantes && pedidoAberto.acompanhantes.length > 1 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Acompanhantes:</h3>
                  <div className="flex flex-wrap gap-2">
                    {pedidoAberto.acompanhantes.map(acomp => (
                      <Button
                        key={acomp.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleFinalizarParcialClick(acomp)}
                      >
                        {acomp.nome}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead>Consumido Por</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Preço Unit.</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidoAberto.itens_pedido.map((item) => {
                    const subtotal = (item.preco || 0) * item.quantidade;
                    const descontoValor = subtotal * ((item.desconto_percentual || 0) / 100);
                    const totalItem = subtotal - descontoValor;
                    const consumidorNome = clientesNaMesa?.find(c => c.id === item.consumido_por_cliente_id)?.nome || "Mesa (Geral)";

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.nome_produto}</TableCell>
                        <TableCell className="text-center">{item.quantidade}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{consumidorNome}</TableCell>
                        <TableCell>
                          {item.status === 'pendente' && <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pendente</Badge>}
                          {item.status === 'preparando' && <Badge variant="outline" className="bg-blue-100 text-blue-800">Preparando</Badge>}
                          {item.status === 'entregue' && <Badge variant="outline" className="bg-green-100 text-green-800">Entregue</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.preco || 0)}</TableCell>
                        <TableCell className="text-right">
                          {item.desconto_percentual ? `${item.desconto_percentual}%` : '0%'}
                          {item.desconto_motivo && <span className="block text-xs text-muted-foreground">({item.desconto_motivo})</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(totalItem)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {item.status !== 'entregue' && item.requer_preparo && (
                                <DropdownMenuItem onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, newStatus: 'preparando' })}>
                                  <Utensils className="w-4 h-4 mr-2" /> Marcar como Preparando
                                </DropdownMenuItem>
                              )}
                              {item.status !== 'entregue' && (
                                <DropdownMenuItem onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, newStatus: 'entregue' })}>
                                  <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Entregue
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleAplicarDescontoClick(item)}>
                                <Percent className="w-4 h-4 mr-2" /> Aplicar Desconto
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Separator />

              <div className="flex justify-between items-center text-xl font-bold">
                <span>Total do Pedido:</span>
                <span>{formatCurrency(totalPedido)}</span>
              </div>
            </>
          )}

          <Separator />

          <h3 className="text-lg font-semibold mb-4">Adicionar Novo Item</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <FormField
                control={form.control}
                name="nome_produto"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Produto</FormLabel>
                    <Select onValueChange={handleProductSelect} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {produtos?.map(prod => (
                          <SelectItem key={prod.id} value={prod.nome} disabled={prod.estoque_atual !== undefined && prod.estoque_atual <= 0 && prod.tipo === 'componente_rodizio'}>
                            {prod.nome} {prod.estoque_atual !== undefined && prod.tipo === 'componente_rodizio' && prod.estoque_atual <= 0 && "(Esgotado)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consumido_por_cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consumido Por</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Mesa (Geral)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Mesa (Geral)</SelectItem>
                        {clientesNaMesa?.map(cliente => (
                          <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={addItemMutation.isPending || !selectedProduto} className="md:col-span-4">
                {addItemMutation.isPending ? "Adicionando..." : "Adicionar Item"}
              </Button>
            </form>
          </Form>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => finalizarPedidoMutation.mutate()} disabled={finalizarPedidoMutation.isPending || !pedidoAberto || pedidoAberto.itens_pedido.length === 0}>
            {finalizarPedidoMutation.isPending ? "Finalizando..." : "Finalizar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <FinalizarContaParcialDialog
        isOpen={isFinalizarParcialOpen}
        onOpenChange={setIsFinalizarParcialOpen}
        cliente={clientePagando}
        itens={itensDoClientePagando}
        onConfirm={() => finalizarPagamentoParcialMutation.mutate()}
        isSubmitting={finalizarPagamentoParcialMutation.isPending}
      />

      <AplicarDescontoDialog
        isOpen={isDescontoOpen}
        onOpenChange={setIsDescontoOpen}
        item={itemParaDesconto}
        onSubmit={(values) => aplicarDescontoMutation.mutate({
          itemId: itemParaDesconto!.id,
          percentual: values.desconto_percentual,
          motivo: values.desconto_motivo,
        })}
        isSubmitting={aplicarDescontoMutation.isPending}
      />
    </Dialog>
  );
}