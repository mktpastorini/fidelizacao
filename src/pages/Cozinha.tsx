import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePageActions } from "@/contexts/PageActionsContext";
import { useEffect } from "react";

type KitchenItem = ItemPedido & {
  pedido: {
    mesa: { numero: number } | null;
  } | null;
  cliente: { nome: string } | null;
};

async function fetchKitchenItems(): Promise<KitchenItem[]> {
  // Itens entregues são mantidos por 30 minutos para visualização
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  // Buscamos todos os itens pendentes/em preparo E itens entregues recentes.
  const orFilter = `status.in.("pendente","preparando"),and(status.eq.entregue,updated_at.gt.${thirtyMinutesAgo.toISOString()})`;

  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      *,
      pedido:pedidos!inner(status, mesa:mesas(numero)),
      cliente:clientes!consumido_por_cliente_id(nome)
    `)
    .or(orFilter)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as KitchenItem[];
}

export default function CozinhaPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setPageActions } = usePageActions();

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["kitchenItems"],
    queryFn: fetchKitchenItems,
    refetchInterval: 15000, // Atualiza a cada 15 segundos
  });

  // Define os botões da página no Header
  useEffect(() => {
    const pageButtons = (
      <Button onClick={() => navigate("/cozinheiros")}>
        <UserPlus className="w-4 h-4 mr-2" /> Gerenciar Cozinheiros
      </Button>
    );
    setPageActions(pageButtons);

    return () => setPageActions(null);
  }, [setPageActions, navigate]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus, imageUrl }: { itemId: string; newStatus: 'preparando' | 'entregue'; imageUrl?: string }) => {
      if (imageUrl) {
        // Se houver imagem, usamos o Edge Function para validação facial
        const { data, error } = await supabase.functions.invoke('process-kitchen-action', {
          body: { itemId, newStatus, image_url: imageUrl },
        });
        if (error) throw new Error(error.message);
        return data;
      } else {
        // Se não houver imagem (apenas para itens sem preparo marcados por Garçom/Balcão), usamos o update direto
        const { error } = await supabase
          .from("itens_pedido")
          .update({ status: newStatus })
          .eq("id", itemId);
        if (error) throw error;
        return { message: "Status do item atualizado!" };
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess(data.message || "Status do item atualizado!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleStatusChange = (itemId: string, newStatus: 'preparando' | 'entregue', imageUrl?: string) => {
    updateStatusMutation.mutate({ itemId, newStatus, imageUrl });
  };

  // Filtra itens para o Kanban
  const filteredItems = items?.filter(item => {
    const nome = item.nome_produto.toUpperCase();
    
    // 1. Exclui itens de Resgate e Rodízio (pacote ou componente)
    if (nome.startsWith('[RESGATE]') || nome.startsWith('[RODIZIO]')) {
      return false;
    }
    
    // 2. Inclui itens que estão pendentes ou em preparo (requer preparo ou não)
    if (item.status === 'pendente' || item.status === 'preparando') {
      return true;
    }
    
    // 3. Inclui itens que foram entregues recentemente (para a coluna "Pronto/Entregue")
    if (item.status === 'entregue') {
      return true;
    }
    
    return false;
  }) || [];

  const pendingItems = filteredItems.filter(item => item.status === 'pendente');
  const preparingItems = filteredItems.filter(item => item.status === 'preparando');
  const deliveredItems = filteredItems.filter(item => item.status === 'entregue');

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
          <KanbanColumn 
            title="Pendente" 
            items={pendingItems} 
            onStatusChange={handleStatusChange} 
            borderColor="border-warning" 
            isUpdating={updateStatusMutation.isPending}
          />
          <KanbanColumn 
            title="Em Preparo" 
            items={preparingItems} 
            onStatusChange={handleStatusChange} 
            borderColor="border-primary" 
            isUpdating={updateStatusMutation.isPending}
          />
          <KanbanColumn 
            title="Pronto/Entregue" 
            items={deliveredItems} 
            onStatusChange={handleStatusChange} 
            borderColor="border-success" 
            isUpdating={updateStatusMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}