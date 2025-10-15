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
  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      *,
      pedido:pedidos!inner(status, mesa:mesas(numero)),
      cliente:clientes!consumido_por_cliente_id(nome)
    `)
    .eq("pedido.status", "aberto")
    .in("status", ["pendente", "preparando"])
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

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
        <p className="text-gray-600 mt-2">Acompanhe o preparo dos pedidos em tempo real.</p>
      </div>
      {isLoading ? (
        <div className="flex gap-4">
          <Skeleton className="flex-1 h-[70vh]" />
          <Skeleton className="flex-1 h-[70vh]" />
          <Skeleton className="flex-1 h-[70vh]" />
        </div>
      ) : isError ? (
        <p className="text-red-500">Erro ao carregar os pedidos.</p>
      ) : (
        <div className="flex gap-4">
          <KanbanColumn title="Pendente" items={pendingItems} onStatusChange={handleStatusChange} className="bg-red-50" />
          <KanbanColumn title="Em Preparo" items={preparingItems} onStatusChange={handleStatusChange} className="bg-yellow-50" />
          <div className="flex-1 bg-green-50 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Pronto / Entregue</h2>
            <div className="h-[calc(100vh-12rem)] overflow-y-auto pr-2">
              <p className="text-sm text-gray-500 text-center mt-8">Itens finalizados aparecerão no pedido da mesa.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}