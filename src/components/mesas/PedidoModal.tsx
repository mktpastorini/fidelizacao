import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Pedido, ItemPedido, Produto, Cliente } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { PlusCircle, Trash2, CreditCard, ChevronsUpDown, Check, Users, UserCheck, Tag, MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FinalizarContaParcialDialog } from "./FinalizarContaParcialDialog";
import { AplicarDescontoDialog } from "./AplicarDescontoDialog";
import { Badge } from "../ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type PedidoModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesa: Mesa | null;
};

const itemSchema = z.object({
  nome_produto: z.string().min(2, "O nome do produto é obrigatório."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  preco: z.coerce.number(),
  consumido_por_cliente_id: z.string().uuid().nullable().optional(),
  status: z.enum(['pendente', 'preparando', 'entregue']),
  requer_preparo: z.boolean(),
});

async function fetchPedidoAberto(mesaId: string): Promise<(Pedido & { itens_pedido: ItemPedido[] }) | null> {
  if (!mesaId) return null;
  const { data, error } = await supabase.from("pedidos").select("*, itens_pedido(*)").eq("mesa_id", mesaId).eq("status", "aberto").order("created_at", { foreignTable: "itens_pedido", ascending: true }).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchOcupantes(mesaId: string): Promise<Cliente[]> {
  const { data: ocupanteIds, error: idsError } = await supabase.from("mesa_ocupantes").select("cliente_id").eq("mesa_id", mesaId);
  if (idsError) throw idsError;

  const ids = ocupanteIds.map(o => o.cliente_id);
  if (ids.length === 0) return [];
  
  const { data: clientes, error: clientesError } = await supabase.from("clientes").select("id, nome").in("id", ids);
  if (clientesError) throw clientesError;
  return clientes;
}

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [clientePagando, setClientePagando] = useState<Cliente | null>(null);
  const [itemParaDesconto, setItemParaDesconto] = useState<ItemPedido | null>(null);
  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { nome_produto: "", quantidade: 1, preco: 0, consumido_por_cliente_id: null, status: 'pendente', requer_preparo: true },
  });

  const { data: pedido, isLoading } = useQuery({
    queryKey: ["pedidoAberto", mesa?.id],
    queryFn: () => fetchPedidoAberto(mesa!.id),
    enabled: !!mesa && isOpen,
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: fetchProdutos,
    enabled: isOpen,
  });

  const { data: ocupantes } = useQuery({
    queryKey: ["ocupantes", mesa?.id],
    queryFn: () => fetchOcupantes(mesa!.id),
    enabled: !!mesa && isOpen,
  });

  const { itensAgrupados, totalPedido } = useMemo(() => {
    if (!pedido?.itens_pedido || !ocupantes) return { itensAgrupados: new Map(), totalPedido: 0 };
    
    const total = pedido.itens_pedido.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
    
    const agrupados = new Map<string, { cliente: Cliente | { id: 'mesa', nome: 'Mesa' }; itens: ItemPedido[]; subtotal: number }>();
    
    ocupantes.forEach(o => agrupados.set(o.id, { cliente: o, itens: [], subtotal: 0 }));
    agrupados.set('mesa', { cliente: { id: 'mesa', nome: 'Mesa (Geral)' }, itens: [], subtotal: 0 });

    pedido.itens_pedido.forEach(item => {
      const key = item.consumido_por_cliente_id || 'mesa';
      const grupo = agrupados.get(key);
      if (grupo) {
        grupo.itens.push(item);
        grupo.subtotal += calcularPrecoComDesconto(item);
      }
    });

    return { itensAgrupados: agrupados, totalPedido: total };
  }, [pedido, ocupantes]);

  const addItemMutation = useMutation({
    mutationFn: async (novoItem: z.infer<typeof itemSchema>) => {
      if (!mesa || !mesa.cliente_id) throw new Error("Mesa ou cliente não selecionado.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado.");

      let pedidoId = pedido?.id;
      if (!pedidoId) {
        const { data: novoPedido, error: pedidoError } = await supabase.from("pedidos").insert({ mesa_id: mesa.id, cliente_id: mesa.cliente_id, user_id: user.id, status: "aberto" }).select("id").single();
        if (pedidoError) throw new Error(pedidoError.message);
        pedidoId = novoPedido.id;
      }

      const { error: itemError } = await supabase.from("itens_pedido").insert({ pedido_id: pedidoId, user_id: user.id, ...novoItem });
      if (itemError) throw new Error(itemError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Item adicionado com sucesso!");
      form.reset({ nome_produto: "", quantidade: 1, preco: 0, consumido_por_cliente_id: null, status: 'pendente', requer_preparo: true });
    },
    onError: (error: Error) => showError(error.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: async (values: { itemId: string; desconto_percentual: number; desconto_motivo?: string }) => {
      const { itemId, ...updateData } = values;
      const { error } = await supabase.from("itens_pedido").update(updateData).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Desconto aplicado com sucesso!");
      setItemParaDesconto(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("itens_pedido").delete().eq("id", itemId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Item removido com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const closePartialOrderMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      if (!pedido) throw new Error("Pedido não encontrado.");
      const { error } = await supabase.rpc('finalizar_pagamento_parcial', {
        p_pedido_id: pedido.id,
        p_cliente_id_pagando: clienteId,
      });
      if (error) throw error;
    },
    onSuccess: (_, clienteId) => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["ocupantes", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      const cliente = ocupantes?.find(o => o.id === clienteId);
      showSuccess(`Conta de ${cliente?.nome || 'cliente'} finalizada!`);
      setClientePagando(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  const closeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!pedido || !mesa || !ocupantes) throw new Error("Pedido, mesa ou ocupantes não encontrados.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const acompanhantesData = ocupantes.map(o => ({ id: o.id, nome: o.nome }));

      await supabase.from("pedidos").update({ 
        status: "pago", 
        closed_at: new Date().toISOString(),
        acompanhantes: acompanhantesData,
      }).eq("id", pedido.id);

      await supabase.from("mesas").update({ cliente_id: null }).eq("id", mesa.id);
      await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesa.id);

      if (mesa.cliente_id) {
        const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', { body: { clientId: mesa.cliente_id, userId: user.id } });
        if (functionError) showError(`Conta fechada, mas falha ao enviar webhook: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Conta fechada com sucesso!");
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const onSubmit = (values: z.infer<typeof itemSchema>) => {
    const produtoSelecionado = produtos?.find(p => p.nome === values.nome_produto);
    const requerPreparo = produtoSelecionado?.requer_preparo ?? true;
    const status = 'pendente';
    addItemMutation.mutate({ ...values, status, requer_preparo: requerPreparo });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Pedido da Mesa {mesa?.numero}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{ocupantes?.map(o => o.nome).join(', ') || "N/A"}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh]">
            <div className="space-y-4 overflow-y-auto pr-2">
              <h3 className="font-semibold">Itens do Pedido</h3>
              {isLoading ? <p>Carregando...</p> : Array.from(itensAgrupados.values()).map(({ cliente, itens, subtotal }) => (
                (itens.length > 0) && (
                  <div key={cliente.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">{cliente.nome}</h4>
                      {cliente.id !== 'mesa' && (
                        <Button size="sm" variant="outline" onClick={() => setClientePagando(cliente as Cliente)}>
                          <UserCheck className="w-4 h-4 mr-2" /> Finalizar Conta
                        </Button>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {itens.map((item) => {
                        const precoOriginal = (item.preco || 0) * item.quantidade;
                        const precoFinal = calcularPrecoComDesconto(item);
                        return (
                          <li key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                            <div>
                              <p className="font-medium">{item.nome_produto} (x{item.quantidade})</p>
                              {item.desconto_percentual && item.desconto_percentual > 0 && (
                                <Badge variant="secondary" className="mt-1">{item.desconto_percentual}% off - {item.desconto_motivo}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="text-right">
                                {item.desconto_percentual && item.desconto_percentual > 0 ? (
                                  <>
                                    <p className="text-gray-500 line-through text-xs">R$ {precoOriginal.toFixed(2)}</p>
                                    <p className="font-semibold">R$ {precoFinal.toFixed(2)}</p>
                                  </>
                                ) : (
                                  <p>R$ {precoOriginal.toFixed(2)}</p>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setItemParaDesconto(item)}>
                                    <Tag className="h-4 w-4 mr-2" />
                                    <span>Aplicar Desconto</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-500" onClick={() => deleteItemMutation.mutate(item.id)}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    <span>Remover Item</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-right font-semibold mt-2">Subtotal: R$ {subtotal.toFixed(2)}</p>
                  </div>
                )
              ))}
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-4">Adicionar Novo Item</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="nome_produto" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Produto</FormLabel>
                      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                              {field.value ? produtos?.find(p => p.nome === field.value)?.nome : "Selecione um produto"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Buscar produto..." /><CommandList><CommandEmpty>Nenhum produto encontrado.</CommandEmpty><CommandGroup>
                          {produtos?.map((produto) => (<CommandItem value={produto.nome} key={produto.id} onSelect={() => {
                            const preco = produto.tipo === 'componente_rodizio' ? 0 : produto.preco;
                            form.setValue("nome_produto", produto.nome);
                            form.setValue("preco", preco);
                            setPopoverOpen(false);
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", produto.nome === field.value ? "opacity-100" : "opacity-0")} />{produto.nome}</CommandItem>))}
                        </CommandGroup></CommandList></Command></PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="quantidade" render={({ field }) => (<FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="consumido_por_cliente_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consumido por</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === 'null' ? null : value)} value={field.value ?? 'null'}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione quem consumiu" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="null">Mesa (Geral)</SelectItem>
                          {ocupantes?.map(ocupante => (<SelectItem key={ocupante.id} value={ocupante.id}>{ocupante.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <Button type="submit" className="w-full" disabled={addItemMutation.isPending}><PlusCircle className="w-4 h-4 mr-2" />Adicionar ao Pedido</Button>
                </form>
              </Form>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total Restante na Mesa:</span>
              <span>R$ {totalPedido.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => closeOrderMutation.mutate()} disabled={!pedido || pedido.itens_pedido.length === 0 || closeOrderMutation.isPending}>
              <CreditCard className="w-4 h-4 mr-2" />
              {closeOrderMutation.isPending ? "Finalizando..." : "Finalizar Conta Total"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FinalizarContaParcialDialog
        isOpen={!!clientePagando}
        onOpenChange={() => setClientePagando(null)}
        cliente={clientePagando}
        itens={itensAgrupados.get(clientePagando?.id || '')?.itens || []}
        onConfirm={() => clientePagando && closePartialOrderMutation.mutate(clientePagando.id)}
        isSubmitting={closePartialOrderMutation.isPending}
      />
      <AplicarDescontoDialog
        isOpen={!!itemParaDesconto}
        onOpenChange={() => setItemParaDesconto(null)}
        item={itemParaDesconto}
        isSubmitting={updateItemMutation.isPending}
        onSubmit={(values) => {
          if (itemParaDesconto) {
            updateItemMutation.mutate({ itemId: itemParaDesconto.id, ...values });
          }
        }}
      />
    </>
  );
}