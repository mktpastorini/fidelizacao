import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido, Cozinheiro } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { CookRecognitionModal } from "@/components/cozinha/CookRecognitionModal";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
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
  cozinheiro: Cozinheiro | null;
};

async function fetchKitchenItems(): Promise<KitchenItem[]> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const orFilter = `status.in.("pendente","preparando"),and(status.eq.entregue,updated_at.gt.${thirtyMinutesAgo.toISOString()})`;

  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      *,
      pedido:pedidos!inner(status, mesa:mesas(numero)),
      cliente:clientes!consumido_por_cliente_id(nome),
      cozinheiro:cozinheiros!cozinheiro_id(id, nome, avatar_url)
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
  
  const [isRecognitionOpen, setIsRecognitionOpen] = useState(false);
  const [itemToProcess, setItemToProcess] = useState<KitchenItem | null>(null);
  const [actionToPerform, setActionToPerform] = useState<'preparando' | 'entregue' | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["kitchenItems"],
    queryFn: fetchKitchenItems,
    refetchInterval: 15000,
  });

  // Define o botão de adicionar cozinheiro no Header
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
    mutationFn: async ({ itemId, newStatus, cookId }: { itemId: string; newStatus: 'preparando' | 'entregue'; cookId: string | null }) => {
      const updatePayload: any = { status: newStatus };
      
      if (newStatus === 'preparando') {
        updatePayload.cozinheiro_id = cookId; // Salva quem iniciou o preparo
      } else if (newStatus === 'entregue') {
        // Não atualiza cozinheiro_id ao entregar, apenas o status
      }
      
      const { error } = await supabase
        .from("itens_pedido")
        .update(updatePayload)
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess("Status do item atualizado!");
      setItemToProcess(null);
      setActionToPerform(null);
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleInitiateRecognition = (item: KitchenItem, action: 'preparando' | 'entregue') => {
    // Se for item sem preparo, Garçom/Balcão pode entregar sem reconhecimento
    if (!item.requer_preparo && action === 'entregue') {
        // Usamos um ID fictício para indicar que a mutação deve ser direta (sem cozinheiro_id)
        handleCookConfirmed(item.id, null); 
        return;
    }
    
    setItemToProcess(item);
    setActionToPerform(action);
    setIsRecognitionOpen(true);
  };

  const handleCookConfirmed = (itemId: string, cookId: string | null) => {
    if (!actionToPerform) return;
    
    // Se for 'entregue' e o item requer preparo, o cookId deve ser o mesmo que iniciou
    if (actionToPerform === 'entregue' && itemToProcess?.requer_preparo && itemToProcess.cozinheiro_id !== cookId) {
        showError("Apenas o cozinheiro que iniciou o preparo pode finalizar este item.");
        return;
    }

    // Se for item sem preparo, passamos null para cookId
    const finalCookId = itemToProcess?.requer_preparo ? cookId : null;

    updateStatusMutation.mutate({ 
        itemId, 
        newStatus: actionToPerform, 
        cookId: finalCookId 
    });
  };

  const filteredItems = items?.filter(item => {
    const nome = item.nome_produto.toUpperCase();
    
    // Exclui itens de Resgate e Rodízio (pacote)
    if (nome.startsWith('[RESGATE]') || nome.startsWith('[RODIZIO]')) {
      return false;
    }
    
    // Itens de Rodízio (componente) são incluídos se requerem preparo
    if (item.tipo === 'componente_rodizio' && !item.requer_preparo) {
        return false;
    }
    
    // Inclui itens que estão pendentes, em preparo ou entregues recentemente
    return item.status !== 'cancelado';
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
          <KanbanColumn title="Pendente" items={pendingItems} onStatusChange={handleInitiateRecognition} borderColor="border-warning" />
          <KanbanColumn title="Em Preparo" items={preparingItems} onStatusChange={handleInitiateRecognition} borderColor="border-primary" />
          <KanbanColumn title="Pronto/Entregue" items={deliveredItems} onStatusChange={handleInitiateRecognition} borderColor="border-success" />
        </div>
      )}
      
      {/* Modal de Reconhecimento Facial */}
      <CookRecognitionModal
        isOpen={isRecognitionOpen}
        onOpenChange={setIsRecognitionOpen}
        item={itemToProcess}
        action={actionToPerform || 'preparando'}
        onCookConfirmed={(cookId) => handleCookConfirmed(itemToProcess!.id, cookId)}
        requiredCookId={itemToProcess?.cozinheiro_id}
      />
    </div>
  );
}