import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Pedido, ItemPedido, Produto } from "@/types/supabase";
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
import { showError, showSuccess } from "@/utils/toast";
import { PlusCircle, Trash2, CreditCard, ChevronsUpDown, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type PedidoModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesa: Mesa | null;
};

const itemSchema = z.object({
  nome_produto: z.string().min(2, "O nome do produto é obrigatório."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  preco: z.coerce.number(),
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

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { nome_produto: "", quantidade: 1, preco: 0 },
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

  const totalPedido = useMemo(() => {
    if (!pedido?.itens_pedido) return 0;
    return pedido.itens_pedido.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0);
  }, [pedido]);

  const addItemMutation = useMutation({
    mutationFn: async (novoItem: z.infer<typeof itemSchema>) => {
      if (!mesa || !mesa.cliente_id) throw new Error("Mesa ou cliente não selecionado.");
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) throw new Error("Usuário não autenticado.");

      let pedidoId = pedido?.id;
      if (!pedidoId) {
        const { data: novoPedido, error: pedidoError } = await supabase.from("pedidos").insert({ mesa_id: mesa.id, cliente_id: mesa.cliente_id, user_id: user.user.id, status: "aberto" }).select().single();
        if (pedidoError) throw new Error(pedidoError.message);
        pedidoId = novoPedido.id;
      }

      const { error: itemError } = await supabase.from("itens_pedido").insert({ pedido_id: pedidoId, user_id: user.user.id, ...novoItem });
      if (itemError) throw new Error(itemError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      showSuccess("Item adicionado com sucesso!");
      form.reset({ nome_produto: "", quantidade: 1, preco: 0 });
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
      showSuccess("Item removido com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const closeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!pedido || !mesa) throw new Error("Pedido ou mesa não encontrado.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      await supabase.from("pedidos").update({ status: "pago", closed_at: new Date().toISOString() }).eq("id", pedido.id);
      await supabase.from("mesas").update({ cliente_id: null }).eq("id", mesa.id);

      if (mesa.cliente_id) {
        const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', { body: { clientId: mesa.cliente_id, userId: user.id } });
        if (functionError) showError(`Conta fechada, mas falha ao enviar webhook: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Conta fechada com sucesso!");
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const onSubmit = (values: z.infer<typeof itemSchema>) => {
    addItemMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pedido da Mesa {mesa?.numero}</DialogTitle>
          <DialogDescription>Cliente: {mesa?.cliente?.nome || "N/A"}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="font-semibold">Itens do Pedido</h3>
            {isLoading ? <p>Carregando...</p> : pedido?.itens_pedido && pedido.itens_pedido.length > 0 ? (
              <ul className="space-y-2">
                {pedido.itens_pedido.map((item) => (
                  <li key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{item.nome_produto} (x{item.quantidade})</p>
                      {item.preco != null && <p className="text-sm text-gray-500">R$ {item.preco.toFixed(2)}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteItemMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-500">Nenhum item adicionado ainda.</p>}
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-4">Adicionar Novo Item</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome_produto"
                  render={({ field }) => (
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
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Buscar produto..." />
                            <CommandList>
                              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                              <CommandGroup>
                                {produtos?.map((produto) => (
                                  <CommandItem
                                    value={produto.nome}
                                    key={produto.id}
                                    onSelect={() => {
                                      form.setValue("nome_produto", produto.nome);
                                      form.setValue("preco", produto.preco);
                                      setPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", produto.nome === field.value ? "opacity-100" : "opacity-0")} />
                                    {produto.nome}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={addItemMutation.isPending}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Adicionar ao Pedido
                </Button>
              </form>
            </Form>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total do Pedido:</span>
            <span>R$ {totalPedido.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => closeOrderMutation.mutate()} disabled={!pedido || pedido.itens_pedido.length === 0 || closeOrderMutation.isPending}>
            <CreditCard className="w-4 h-4 mr-2" />
            {closeOrderMutation.isPending ? "Finalizando..." : "Finalizar e Pagar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}