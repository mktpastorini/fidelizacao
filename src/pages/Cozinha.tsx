import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageActions } from "@/contexts/PageActionsContext";
import React from "react";

type KitchenItem = ItemPedido & {
  pedido: {
    mesa: { numero: number } | null;
  } | null;
  cliente: { nome: string } | null;
};

async function fetchKitchenItems(): Promise<KitchenItem[]> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      *,
      pedido:pedidos!inner(status, mesa:mesas(numero)),
      cliente:clientes!consumido_por_cliente_id(nome)
    `)
    .eq("pedido.status", "aberto")
    .or(`status.in.("pendente","preparando"),and(status.eq.entregue,updated_at.gt.${thirtyMinutesAgo.toISOString()})`)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as KitchenItem[];
}

export default function CozinhaPage() {
  const queryClient = useQueryClient();
  const { setPageActions } = usePageActions();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["kitchenItems"],
    queryFn: fetchKitchenItems,
    refetchInterval: 15000, // Atualiza a cada 15 segundos
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: 'preparando' | 'entregue' }) => {
      const { error } = await supabase
        .from("itens_pedido")
        .update({ status: newStatus })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      showSuccess("Status do item atualizado!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleStatusChange = (itemId: string, newStatus: 'preparando' | 'entregue') => {
    updateStatusMutation.mutate({ itemId, newStatus });
  };

  const pendingItems = items?.filter(item => item.status === 'pendente') || [];
  const preparingItems = items?.filter(item => item.status === 'preparando') || [];
  const deliveredItems = items?.filter(item => item.status === 'entregue') || [];

  // Define os botões específicos da página para o cabeçalho
  useEffect(() => {
    const pageButtons = (
      <div className="flex items-center gap-2">
        {/* No painel da cozinha, não há botões específicos no cabeçalho */}
      </div>
    );
    setPageActions(pageButtons);

    return () => setPageActions(null); // Clean up on unmount
  }, [setPageActions]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
        <p className="text-muted-foreground mt-1">Acompanhe o preparo dos pedidos em tempo real.</p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex gap-6">
          <Skeleton className="flex-1" />
          <Skeleton className="flex-1" />
          <Skeleton className="flex-1" />
        </div>
      ) : isError ? (
        <p className="text-destructive">Erro ao carregar os pedidos.</p>
      ) : (
        <div className="flex-1 flex gap-6">
          <KanbanColumn title="Pendente" items={pendingItems} onStatusChange={handleStatusChange} borderColor="border-warning" />
          <KanbanColumn title="Em Preparo" items={preparingItems} onStatusChange={handleStatusChange} borderColor="border-primary" />
          <KanbanColumn title="Pronto/Entregue" items={deliveredItems} onStatusChange={handleStatusChange} borderColor="border-success" />
        </div>
      )}
    </div>
  );
}