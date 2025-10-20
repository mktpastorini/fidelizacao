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

const itemSchema = z.object({
  nome_produto: z.string().min(2, "O nome do produto é obrigatório."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  preco: z.coerce.number(),
  consumido_por_cliente_id: z.string().uuid().nullable().optional(),
  status: z.enum(['pendente', 'preparando', 'entregue']),
  requer_preparo: z.boolean(),
});

async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

export function PedidoModal({ isOpen, onOpenChange, mesa }) {
  const queryClient = useQueryClient();
  const { data: produtos } = useQuery(["produtos"], fetchProdutos, { enabled: isOpen });

  const addItemMutation = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("itens_pedido").insert(item);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["itensPedido", mesa?.id]);
    },
  });

  const form = useForm({
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

  const onSubmit = (values) => {
    const produtoSelecionado = produtos?.find(p => p.nome === values.nome_produto);
    let requerPreparo = true;
    let status = 'pendente';

    if (produtoSelecionado) {
      // Se for tipo rodizio (pacote rodizio), não vai para cozinha e não requer preparo
      if (produtoSelecionado.tipo === 'rodizio') {
        requerPreparo = false;
        status = 'entregue';
      } else if (produtoSelecionado.tipo === 'venda') {
        // Alacarte: vai para cozinha e requer preparo
        requerPreparo = true;
        status = 'pendente';
      } else if (produtoSelecionado.tipo === 'componente_rodizio') {
        // Componente rodizio: pode ter preparo, depende do produto
        requerPreparo = produtoSelecionado.requer_preparo ?? true;
        status = 'pendente';
      }
    }

    addItemMutation.mutate({ ...values, status, requer_preparo: requerPreparo });
    form.reset({ nome_produto: "", quantidade: 1, preco: 0, consumido_por_cliente_id: null, status: "pendente", requer_preparo: true });
  };

  return (
    // JSX do modal com formulário para adicionar item, usando form.handleSubmit(onSubmit)
    // ... (restante do componente permanece igual)
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Select onValueChange={(val) => {
        form.setValue("nome_produto", val);
        const prod = produtos?.find(p => p.nome === val);
        if (prod) form.setValue("preco", prod.preco);
      }} value={form.watch("nome_produto")}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um produto" />
        </SelectTrigger>
        <SelectContent>
          {produtos?.map(prod => (
            <SelectItem key={prod.id} value={prod.nome}>{prod.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="number" {...form.register("quantidade")} min={1} />
      <Input type="number" step="0.01" {...form.register("preco")} />
      <Button type="submit" disabled={addItemMutation.isLoading}>Adicionar</Button>
    </form>
  );
}