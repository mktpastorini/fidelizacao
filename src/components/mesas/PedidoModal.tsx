import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Pedido, ItemPedido } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { PlusCircle, Trash2 } from "lucide-react";

type PedidoModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesa: Mesa | null;
};

const itemSchema = z.object({
  nome_produto: z.string().min(2, "O nome do produto é obrigatório."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  preco: z.coerce.number().optional(),
});

async function fetchPedidoAberto(mesaId: string): Promise<(Pedido & { itens_pedido: ItemPedido[] }) | null> {
  if (!mesaId) return null;

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .order("created_at", { foreignTable: "itens_pedido", ascending: true })
    .maybeSingle();

  if (error) throw new Error(error.message);
  return pedido;
}

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { nome_produto: "", quantidade: 1, preco: undefined },
  });

  const { data: pedido, isLoading } = useQuery({
    queryKey: ["pedidoAberto", mesa?.id],
    queryFn: () => fetchPedidoAberto(mesa!.id),
    enabled: !!mesa && isOpen,
  });

  const addItemMutation = useMutation({
    mutationFn: async (novoItem: z.infer<typeof itemSchema>) => {
      if (!mesa || !mesa.cliente_id) throw new Error("Mesa ou cliente não selecionado.");
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) throw new Error("Usuário não autenticado.");

      let pedidoId = pedido?.id;

      // Se não houver pedido aberto, cria um novo
      if (!pedidoId) {
        const { data: novoPedido, error: pedidoError } = await supabase
          .from("pedidos")
          .insert({
            mesa_id: mesa.id,
            cliente_id: mesa.cliente_id,
            user_id: user.user.id,
            status: "aberto",
          })
          .select()
          .single();
        if (pedidoError) throw new Error(pedidoError.message);
        pedidoId = novoPedido.id;
      }

      // Adiciona o item ao pedido
      const { error: itemError } = await supabase.from("itens_pedido").insert({
        pedido_id: pedidoId,
        user_id: user.user.id,
        ...novoItem,
      });
      if (itemError) throw new Error(itemError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      showSuccess("Item adicionado com sucesso!");
      form.reset();
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
          {/* Coluna de Itens */}
          <div className="space-y-4">
            <h3 className="font-semibold">Itens do Pedido</h3>
            {isLoading ? (
              <p>Carregando...</p>
            ) : pedido?.itens_pedido && pedido.itens_pedido.length > 0 ? (
              <ul className="space-y-2">
                {pedido.itens_pedido.map((item) => (
                  <li key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{item.nome_produto} (x{item.quantidade})</p>
                      {item.preco && <p className="text-sm text-gray-500">R$ {item.preco.toFixed(2)}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteItemMutation.mutate(item.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nenhum item adicionado ainda.</p>
            )}
          </div>

          {/* Coluna para Adicionar Item */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-4">Adicionar Novo Item</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome_produto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produto</FormLabel>
                      <FormControl><Input placeholder="Ex: Pizza de Calabresa" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="quantidade"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Qtd.</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="preco"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Preço (un.)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="Opcional" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={addItemMutation.isPending}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Adicionar ao Pedido
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}