import { ItemPedido, Cozinheiro } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Utensils, CheckCircle, AlertTriangle, Package } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useState, useMemo } from "react";
import { CookRecognitionModal } from "./CookRecognitionModal";
import { showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type KanbanCardProps = {
  item: ItemPedido & {
    pedido: {
      id: string;
      mesa: { numero: number } | null;
      order_type?: 'SALAO' | 'IFOOD' | 'DELIVERY';
      delivery_details?: any;
    } | null;
    cliente: { nome: string } | null;
    cozinheiro: { nome: string } | null;
  };
  onStatusChange: (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string | null) => void;
};

function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000));
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
  const isIfoodOrder = item.pedido?.order_type === 'IFOOD';
  const isDeliveryOrder = item.pedido?.order_type === 'DELIVERY';

  const canManagePreparation = userRole && ['cozinha', 'superadmin', 'admin', 'gerente'].includes(userRole);
  const canDeliverNonPrep = userRole && ['garcom', 'balcao', 'superadmin', 'admin', 'gerente'].includes(userRole);

  const handleRecognitionSuccess = (cook: Cozinheiro) => {
    if (pendingAction === 'start_prep') {
      onStatusChange(item.id, 'preparando', cook.id);
    } else if (pendingAction === 'finish_prep') {
      if (item.requer_preparo && item.cozinheiro_id && item.cozinheiro_id !== cook.id) {
        showError(`Apenas o cozinheiro que iniciou o preparo pode finalizá-lo.`);
        return;
      }
      onStatusChange(item.id, 'entregue', cook.id);
    }
    setPendingAction(null);
    setIsModalOpen(false);
  };
  
  const handleActionClick = async (action: 'start_prep' | 'finish_prep') => {
    if (isNonPrepItem && action === 'finish_prep') {
        if (canDeliverNonPrep) {
            onStatusChange(item.id, 'entregue', null); 
            return;
        }
    }
    
    setPendingAction(action);
    setIsModalOpen(true);
  };
  
  const tempoPreparo = useMemo(() => {
    if (item.hora_inicio_preparo && item.hora_entrega) {
      const start = new Date(item.hora_inicio_preparo);
      const end = new Date(item.hora_entrega);
      const diffMinutes = differenceInMinutes(end, start);
      return `${diffMinutes} min`;
    }
    return null;
  }, [item.hora_inicio_preparo, item.hora_entrega]);

  return (
    <>
      <Card className="mb-4 bg-background shadow-md">
        <CardContent className="p-4 space-y-3">
          <div>
            {isIfoodOrder ? (
              <Badge variant="destructive" className="mb-1 flex items-center w-fit">
                <img src="/ifood-icon.png" alt="iFood" className="w-3 h-3 mr-1" /> iFood Delivery
              </Badge>
            ) : isDeliveryOrder ? (
              <Badge variant="secondary" className="mb-1 flex items-center w-fit">
                <Package className="w-3 h-3 mr-1" /> Delivery
              </Badge>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">MESA {item.pedido?.mesa?.numero || '?'}</p>
            )}
            <h3 className="text-lg font-bold text-foreground">{item.nome_produto} (x{item.quantidade})</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-1 border-t pt-3">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-2" />
              <span>{item.cliente?.nome || "Cliente não identificado"}</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              <span className={cn(isOverdue ? "text-destructive font-semibold" : "")}>Pedido há {tempoDesdePedido}</span>
            </div>
            {item.cozinheiro?.nome && (
                <div className="flex items-center text-xs text-primary">
                    <Utensils className="w-3 h-3 mr-2" />
                    <span>Responsável: {item.cozinheiro.nome}</span>
                </div>
            )}
            {tempoPreparo && (
                <div className="flex items-center text-xs text-success">
                    <Clock className="w-3 h-3 mr-2" />
                    <span>Tempo de Preparo: {tempoPreparo}</span>
                </div>
            )}
          </div>
          <div className="pt-2">
            {item.status === 'pendente' && isNonPrepItem && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => handleActionClick('finish_prep')}
                  disabled={!canDeliverNonPrep}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Entregar ao Cliente
                </Button>
            )}
            {item.status === 'pendente' && !isNonPrepItem && (
                <>
                  <Button 
                    size="sm" 
                    className="w-full" 
                    onClick={() => handleActionClick('start_prep')}
                    disabled={!canManagePreparation}
                  >
                    <Utensils className="w-4 h-4 mr-2" />
                    {isIfoodOrder ? "Confirmar e Preparar" : "Preparar"}
                  </Button>
                  {!canManagePreparation && (
                    <div className="mt-2 text-xs text-warning-foreground bg-warning/10 p-2 rounded-md flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
                      Apenas a Cozinha/Gerência pode iniciar o preparo.
                    </div>
                  )}
                </>
            )}
            {item.status === 'preparando' && (
              <Button 
                size="sm" 
                className="w-full bg-green-600 hover:bg-green-700 text-primary-foreground" 
                onClick={() => handleActionClick('finish_prep')}
                disabled={!canManagePreparation}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isIfoodOrder ? "Pronto / Despachar" : "Pronto"}
              </Button>
            )}
            {item.status === 'entregue' && (
                <Button size="sm" variant="secondary" className="w-full" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" /> {isIfoodOrder ? "Despachado" : "Entregue"}
                </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
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