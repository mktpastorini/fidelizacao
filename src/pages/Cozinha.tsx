import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

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

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
        <p className="text-gray-600 mt-2">Acompanhe o preparo dos pedidos em tempo real.</p>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Como funciona a coluna "Pronto/Entregue"</AlertTitle>
        <AlertDescription>
          Itens finalizados aparecerão aqui e ficarão visíveis por 30 minutos antes de serem removidos automaticamente. Isso ajuda a equipe a não perder nenhuma entrega.
        </AlertDescription>
      </Alert>

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
          <KanbanColumn title="Pronto/Entregue" items={deliveredItems} onStatusChange={handleStatusChange} className="bg-green-50" />
        </div>
      )}
    </div>
  );
}