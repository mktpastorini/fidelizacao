import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";

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
  // A filtragem de itens de rodízio (que não devem aparecer) será feita no frontend.
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
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: 'preparando' | 'entregue' }) => {
      const { error } = await supabase
        .from("itens_pedido")
        .update({ status: newStatus })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Força o refetch para atualizar o Kanban imediatamente
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      // Invalida também os pedidos pendentes do sininho
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess("Status do item atualizado!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleStatusChange = (itemId: string, newStatus: 'preparando' | 'entregue') => {
    updateStatusMutation.mutate({ itemId, newStatus });
  };

  // Filtra itens de rodízio/componente de rodízio (que geralmente têm nome_produto começando com [RESGATE] ou [RODIZIO])
  // E também filtra itens que já foram entregues, mas que não requerem preparo (para evitar duplicidade se o garçom já entregou)
  const filteredItems = items?.filter(item => 
    !item.nome_produto.startsWith('[RESGATE]') && 
    !item.nome_produto.startsWith('[RODIZIO]')
  ) || [];

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