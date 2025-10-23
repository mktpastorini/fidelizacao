import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

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

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["kitchenItems"],
    queryFn: fetchKitchenItems,
    refetchInterval: 15000, // Atualiza a cada 15 segundos
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus, cookId }: { itemId: string; newStatus: 'preparando' | 'entregue'; cookId: string }) => {
      const updatePayload: Partial<ItemPedido> = { status: newStatus };
      
      if (newStatus === 'preparando') {
        updatePayload.cozinheiro_id = cookId;
        updatePayload.hora_inicio_preparo = new Date().toISOString();
      } else if (newStatus === 'entregue') {
        updatePayload.hora_entrega = new Date().toISOString();
        
        // Se o item não tinha cozinheiro_id (ex: item sem preparo entregue por Garçom/Balcão),
        // usamos o cookId passado (que será o ID do usuário logado).
        if (!items?.find(i => i.id === itemId)?.cozinheiro_id) {
            updatePayload.cozinheiro_id = cookId;
        }
      }
      
      const { error } = await supabase
        .from("itens_pedido")
        .update(updatePayload)
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Força o refetch para atualizar o Kanban imediatamente
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      // Invalida também os pedidos pendentes do sininho
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      // Invalida dados do salão para atualizar o status da mesa (se for o último item)
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Status do item atualizado!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleStatusChange = (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string) => {
    updateStatusMutation.mutate({ itemId, newStatus, cookId });
  };

  // Filtra itens para o Kanban
  const filteredItems = items?.filter(item => {
    const nome = item.nome_produto.toUpperCase();
    
    // 1. Exclui itens de Resgate e Rodízio (pacote ou componente)
    if (nome.startsWith('[RESGATE]') || nome.startsWith('[RODIZIO]')) {
      return false;
    }
    
    // 2. Inclui itens que estão pendentes ou em preparo E que requerem preparo
    if ((item.status === 'pendente' || item.status === 'preparando') && item.requer_preparo) {
      return true;
    }
    
    // 3. Inclui itens de venda direta (requer_preparo=false) que estão pendentes (para Garçom/Balcão entregar)
    if (item.status === 'pendente' && !item.requer_preparo) {
        return true;
    }
    
    // 4. Inclui itens que foram entregues recentemente (para a coluna "Pronto/Entregue")
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
          <KanbanColumn title="Pendente" items={pendingItems} onStatusChange={handleStatusChange} borderColor="border-warning" />
          <KanbanColumn title="Em Preparo" items={preparingItems} onStatusChange={handleStatusChange} borderColor="border-primary" />
          <KanbanColumn title="Pronto/Entregue" items={deliveredItems} onStatusChange={handleStatusChange} borderColor="border-success" />
        </div>
      )}
    </div>
  );
}