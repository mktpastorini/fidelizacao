import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido, Cozinheiro } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { CookRecognitionModal } from "@/components/cozinha/CookRecognitionModal";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";

type KitchenItem = ItemPedido & {
  pedido: {
    mesa: { numero: number } | null;
  } | null;
  cliente: { nome: string } | null;
  cozinheiro: Cozinheiro | null;
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
      cliente:clientes!consumido_por_cliente_id(nome),
      cozinheiro:cozinheiros(nome)
    `)
    .or(orFilter)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as KitchenItem[];
}

export default function CozinhaPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { userRole } = useSettings();
  
  const [isRecognitionOpen, setIsRecognitionOpen] = useState(false);
  const [itemToProcess, setItemToProcess] = useState<KitchenItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<'preparando' | 'entregue'>('preparando');

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["kitchenItems"],
    queryFn: fetchKitchenItems,
    refetchInterval: 15000, // Atualiza a cada 15 segundos
  });

  // Mutação para itens que REQUEREM PREPARO (usa reconhecimento facial)
  const processKitchenActionMutation = useMutation({
    mutationFn: async ({ itemId, newStatus, image_url }: { itemId: string; newStatus: 'preparando' | 'entregue'; image_url: string }) => {
      const { data, error } = await supabase.functions.invoke('process-kitchen-action', {
        body: { itemId, newStatus, image_url },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
      showSuccess(data.message || "Status do item atualizado!");
      setIsRecognitionOpen(false);
      setItemToProcess(null);
    },
    onError: (err: Error) => showError(err.message),
  });
  
  // Mutação para itens que NÃO REQUEREM PREPARO (Garçom/Balcão)
  const deliverNonPrepItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("itens_pedido")
        .update({ status: 'entregue' })
        .eq("id", itemId);
      if (error) throw error;
      return { message: "Item entregue ao cliente." };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
      showSuccess(data.message);
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleInitiateRecognition = (item: KitchenItem, status: 'preparando' | 'entregue') => {
    const isNonPrepByStaff = !item.requer_preparo && ['garcom', 'balcao', 'superadmin', 'admin', 'gerente'].includes(userRole!);
    
    if (isNonPrepByStaff && status === 'entregue') {
      // 1. Fluxo Rápido (Garçom/Balcão entregando item sem preparo)
      deliverNonPrepItemMutation.mutate(item.id);
    } else {
      // 2. Fluxo de Cozinha (Requer preparo OU Cozinha/Gerência está agindo)
      setItemToProcess(item);
      setTargetStatus(status);
      setIsRecognitionOpen(true);
    }
  };

  const handleCookConfirmed = (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string) => {
    // Captura a imagem do modal (que deve ter o ID 'cook-recognition-snapshot')
    const snapshotElement = document.getElementById('cook-recognition-snapshot') as HTMLImageElement;
    const snapshot = snapshotElement?.src;
    
    if (!snapshot) {
        showError("Falha ao capturar a imagem para confirmação.");
        return;
    }
    
    // Chama a mutação principal que usa o Edge Function
    processKitchenActionMutation.mutate({ itemId, newStatus, image_url: snapshot });
  };

  // Filtra itens para o Kanban
  const filteredItems = items?.filter(item => {
    const nome = item.nome_produto.toUpperCase();
    
    // Exclui itens de Resgate e Pacote Rodízio (o pacote rodízio não é um item de preparo)
    if (nome.startsWith('[RESGATE]') || nome.startsWith('[RODIZIO]')) {
      return false;
    }
    
    // Inclui itens que requerem preparo OU itens sem preparo que ainda estão pendentes
    if (item.requer_preparo || item.status !== 'entregue') {
        return true;
    }
    
    // Inclui itens que foram entregues recentemente (para visualização)
    if (item.status === 'entregue') {
      return true;
    }
    
    return false;
  }) || [];

  const pendingItems = filteredItems.filter(item => item.status === 'pendente');
  const preparingItems = filteredItems.filter(item => item.status === 'preparando');
  const deliveredItems = filteredItems.filter(item => item.status === 'entregue');
  
  const canManageCozinheiros = userRole && ['superadmin', 'admin', 'gerente'].includes(userRole);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
          <p className="text-muted-foreground mt-1">Acompanhe o preparo dos pedidos em tempo real.</p>
        </div>
        {canManageCozinheiros && (
          <Button variant="outline" onClick={() => navigate('/cozinheiros')}>
            <UserCog className="w-4 h-4 mr-2" /> Gerenciar Cozinheiros
          </Button>
        )}
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
        <div className="flex-1 flex gap-6 min-h-0">
          <KanbanColumn title="Pendente" items={pendingItems} onStatusChange={handleInitiateRecognition} borderColor="border-warning" />
          <KanbanColumn title="Em Preparo" items={preparingItems} onStatusChange={handleInitiateRecognition} borderColor="border-primary" />
          <KanbanColumn title="Pronto/Entregue" items={deliveredItems} onStatusChange={handleInitiateRecognition} borderColor="border-success" />
        </div>
      )}
      
      <CookRecognitionModal
        isOpen={isRecognitionOpen}
        onOpenChange={setIsRecognitionOpen}
        item={itemToProcess}
        targetStatus={targetStatus}
        onCookConfirmed={handleCookConfirmed}
        isSubmitting={processKitchenActionMutation.isPending || deliverNonPrepItemMutation.isPending}
      />
    </div>
  );
}