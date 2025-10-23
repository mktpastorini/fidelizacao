import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemPedido } from "@/types/supabase";
import { KanbanColumn } from "@/components/cozinha/KanbanColumn";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { KitchenConfirmationDialog } from "@/components/cozinha/KitchenConfirmationDialog";
import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CozinheiroManager } from "@/components/cozinha/CozinheiroManager";

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
  const { userRole } = useSettings();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ itemId: string; newStatus: 'preparando' | 'entregue' } | null>(null);

  const isManagerOrAdmin = !!userRole && ['superadmin', 'admin', 'gerente'].includes(userRole);

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
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess("Status do item atualizado!");
      setPendingAction(null);
    },
    onError: (err: Error) => {
      showError(err.message);
      setPendingAction(null);
    },
  });

  // Função chamada pelo KanbanCard para iniciar a ação (se for item sem preparo, executa direto)
  const handleStatusChange = (itemId: string, newStatus: 'preparando' | 'entregue') => {
    // Para itens SEM preparo, Garçom/Balcão/Gerência pode executar diretamente
    updateStatusMutation.mutate({ itemId, newStatus });
  };

  // Função chamada pelo KanbanCard para iniciar o fluxo de confirmação facial
  const handleConfirmAction = (itemId: string, newStatus: 'preparando' | 'entregue') => {
    setPendingAction({ itemId, newStatus });
    setIsConfirmationOpen(true);
  };

  // Função chamada pelo modal após a confirmação facial
  const handleConfirmed = (confirmedUserId: string) => {
    if (pendingAction) {
      // O modal já garantiu que o rosto corresponde ao usuário logado.
      updateStatusMutation.mutate(pendingAction);
    }
  };
  
  const { data: user } = supabase.auth.getUser();
  const currentUserId = user?.user?.id || '';

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
          <p className="text-muted-foreground mt-1">Acompanhe o preparo dos pedidos em tempo real.</p>
        </div>
        {isManagerOrAdmin && (
          <Button onClick={() => setIsManagerOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Gerenciar Cozinheiros
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
        <div className="flex-1 flex gap-6">
          <KanbanColumn 
            title="Pendente" 
            items={pendingItems} 
            onStatusChange={handleStatusChange} 
            onConfirmAction={handleConfirmAction}
            borderColor="border-warning" 
          />
          <KanbanColumn 
            title="Em Preparo" 
            items={preparingItems} 
            onStatusChange={handleStatusChange} 
            onConfirmAction={handleConfirmAction}
            borderColor="border-primary" 
          />
          <KanbanColumn 
            title="Pronto/Entregue" 
            items={deliveredItems} 
            onStatusChange={handleStatusChange} 
            onConfirmAction={handleConfirmAction}
            borderColor="border-success" 
          />
        </div>
      )}
      
      {/* Modal de Confirmação Facial */}
      <KitchenConfirmationDialog
        isOpen={isConfirmationOpen}
        onOpenChange={setIsConfirmationOpen}
        onConfirmed={handleConfirmed}
        isSubmitting={updateStatusMutation.isPending}
        targetUserId={currentUserId}
      />
      
      {/* Modal de Gerenciamento de Cozinheiros */}
      <Dialog open={isManagerOpen} onOpenChange={setIsManagerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Cozinheiros</DialogTitle>
          </DialogHeader>
          <CozinheiroManager />
        </DialogContent>
      </Dialog>
    </div>
  );
}