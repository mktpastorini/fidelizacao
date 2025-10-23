import { ItemPedido, Cozinheiro } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Utensils, CheckCircle, AlertTriangle, Lock } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import { CookRecognitionModal } from "./CookRecognitionModal"; // Importado
import { showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client"; // Importado supabase

type KanbanCardProps = {
  item: ItemPedido & {
    pedido: {
      mesa: { numero: number } | null;
    } | null;
    cliente: { nome: string } | null;
  };
  onStatusChange: (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string) => void;
};

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

export function KanbanCard({ item, onStatusChange }: KanbanCardProps) {
  const { userRole } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'start_prep' | 'finish_prep' | null>(null);
  
  const now = getBrazilTime();
  const createdAt = new Date(item.created_at);
  const tempoDesdePedido = formatDistanceToNow(createdAt, { locale: ptBR });
  const minutesSinceCreation = differenceInMinutes(now, createdAt);

  const isOverdue = minutesSinceCreation > 5 && item.status === 'pendente';

  const isNonPrepItem = !item.requer_preparo;
  
  // Apenas Cozinha, Superadmin, Admin e Gerente podem iniciar o preparo ou marcar como pronto
  const canManagePreparation = userRole && ['cozinha', 'superadmin', 'admin', 'gerente'].includes(userRole);
  
  // Garçons e Balcões podem marcar itens SEM PREPARO como entregues
  const canDeliverNonPrep = userRole && ['garcom', 'balcao', 'superadmin', 'admin', 'gerente'].includes(userRole);

  const handleRecognitionSuccess = (cook: Cozinheiro) => {
    if (pendingAction === 'start_prep') {
      onStatusChange(item.id, 'preparando', cook.id);
    } else if (pendingAction === 'finish_prep') {
      // Verifica se é o mesmo cozinheiro que iniciou o preparo (apenas se o item requer preparo)
      if (item.requer_preparo && item.cozinheiro_id && item.cozinheiro_id !== cook.id) {
        showError(`Apenas o cozinheiro que iniciou o preparo pode finalizá-lo.`);
        return;
      }
      onStatusChange(item.id, 'entregue', cook.id);
    }
    setPendingAction(null);
  };
  
  const handleActionClick = async (action: 'start_prep' | 'finish_prep') => {
    // Obtém o ID do usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    if (!userId) {
        showError("Usuário não autenticado.");
        return;
    }

    if (isNonPrepItem && action === 'finish_prep') {
        // Se for item sem preparo, Garçom/Balcão pode entregar diretamente
        if (canDeliverNonPrep) {
            // Usa o ID do usuário logado como cookId
            onStatusChange(item.id, 'entregue', userId); 
            return;
        }
    }
    
    // Para itens que requerem preparo, ou para iniciar o preparo, exige reconhecimento
    setPendingAction(action);
    setIsModalOpen(true);
  };

  return (
    <>
      <Card className="mb-4 bg-background shadow-md">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">MESA {item.pedido?.mesa?.numero || '?'}</p>
            <h3 className="text-lg font-bold text-foreground">{item.nome_produto} (x{item.quantidade})</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-1 border-t pt-3">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-2" />
              <span>{item.cliente?.nome || "Mesa (Geral)"}</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              <span className={cn(isOverdue ? "text-destructive font-semibold" : "")}>Há {tempoDesdePedido}</span>
            </div>
            {item.cozinheiro_id && (
                <div className="flex items-center text-xs text-primary">
                    <Utensils className="w-3 h-3 mr-2" />
                    <span>Cozinheiro ID: {item.cozinheiro_id.substring(0, 8)}...</span>
                </div>
            )}
          </div>
          <div className="pt-2">
            {item.status === 'pendente' && (
              isNonPrepItem ? (
                // Item sem preparo: Garçom/Balcão pode marcar como entregue
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => handleActionClick('finish_prep')} // Chama handleActionClick
                  disabled={!canDeliverNonPrep}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Entregar ao Cliente
                </Button>
              ) : (
                // Item com preparo: Ação restrita à Cozinha/Gerência
                <>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    onClick={() => handleActionClick('start_prep')} // Chama handleActionClick
                    disabled={!canManagePreparation}
                  >
                    <Utensils className="w-4 h-4 mr-2" />
                    Preparar
                  </Button>
                  {!canManagePreparation && (
                    <div className="mt-2 text-xs text-warning-foreground bg-warning/10 p-2 rounded-md flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
                      Apenas a Cozinha/Gerência pode iniciar o preparo.
                    </div>
                  )}
                </>
              )
            )}
            {item.status === 'preparando' && (
              // Item em preparo: Cozinha marca como pronto
              <Button 
                size="sm" 
                className="w-full bg-green-600 hover:bg-green-700 text-primary-foreground" 
                onClick={() => handleActionClick('finish_prep')} // Chama handleActionClick
                disabled={!canManagePreparation}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Pronto
              </Button>
            )}
            {item.status === 'entregue' && (
                <Button size="sm" variant="secondary" className="w-full" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" /> Entregue
                </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Modal de Reconhecimento Facial */}
      <CookRecognitionModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        item={item}
        action={pendingAction || 'start_prep'}
        onCookRecognized={handleRecognitionSuccess}
      />
    </>
  );
}