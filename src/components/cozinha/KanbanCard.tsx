import { ItemPedido } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Utensils, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import { CookRecognitionModal } from "./CookRecognitionModal"; // Importado

type KanbanCardProps = {
  item: ItemPedido & {
    pedido: {
      mesa: { numero: number } | null;
    } | null;
    cliente: { nome: string } | null;
    cozinheiro: { nome: string } | null; // Adicionado cozinheiro
  };
  onStatusChange: (itemId: string, newStatus: 'preparando' | 'entregue', imageUrl?: string) => void;
  isUpdating: boolean;
};

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

export function KanbanCard({ item, onStatusChange, isUpdating }: KanbanCardProps) {
  const { userRole } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<'preparando' | 'entregue' | null>(null);
  
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

  const handleActionClick = (status: 'preparando' | 'entregue') => {
    if (isNonPrepItem && status === 'entregue') {
        // Itens sem preparo: Ação direta (não requer reconhecimento facial)
        onStatusChange(item.id, 'entregue');
    } else if (canManagePreparation) {
        // Itens com preparo: Requer reconhecimento facial
        setNextStatus(status);
        setIsModalOpen(true);
    }
  };
  
  const handleCookRecognized = (imageUrl: string) => {
    if (nextStatus) {
        onStatusChange(item.id, nextStatus, imageUrl);
    }
    setNextStatus(null);
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
            <div className={cn("flex items-center", isOverdue ? "text-destructive font-semibold" : "")}>
              <Clock className="w-4 h-4 mr-2" />
              <span>Há {tempoDesdePedido}</span>
            </div>
            {item.cozinheiro && item.status === 'preparando' && (
                <div className="text-xs text-primary font-semibold">
                    <Utensils className="w-4 h-4 mr-2 inline" />
                    Em preparo por: {item.cozinheiro.nome}
                </div>
            )}
          </div>
          <div className="pt-2">
            {isUpdating ? (
                <Button size="sm" className="w-full" disabled>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando...
                </Button>
            ) : item.status === 'pendente' && (
              isNonPrepItem ? (
                // Item sem preparo: Garçom/Balcão pode marcar como entregue
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => handleActionClick('entregue')}
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
                    onClick={() => handleActionClick('preparando')}
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
                onClick={() => handleActionClick('entregue')}
                disabled={!canManagePreparation} // Também restringe a finalização do preparo
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Pronto
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      <CookRecognitionModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCookRecognized={handleCookRecognized}
        isSubmitting={isUpdating}
        actionTitle={nextStatus === 'preparando' ? "Confirme sua identidade para iniciar o preparo." : "Confirme sua identidade para marcar como pronto."}
      />
    </>
  );
}