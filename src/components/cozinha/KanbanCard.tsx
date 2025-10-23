import { ItemPedido } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Utensils, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

type KanbanCardProps = {
  item: ItemPedido & {
    pedido: {
      mesa: { numero: number } | null;
    } | null;
    cliente: { nome: string } | null;
    cozinheiro: { nome: string } | null; // Adicionado cozinheiro
  };
  onInitiateRecognition: (item: KanbanCardProps['item'], targetStatus: 'preparando' | 'entregue') => void;
  isProcessing: boolean;
};

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

export function KanbanCard({ item, onInitiateRecognition, isProcessing }: KanbanCardProps) {
  const { userRole } = useSettings();
  const now = getBrazilTime();
  const createdAt = new Date(item.created_at);
  const tempoDesdePedido = formatDistanceToNow(createdAt, { locale: ptBR });
  const minutesSinceCreation = differenceInMinutes(now, createdAt);

  const isOverdue = minutesSinceCreation > 5 && item.status === 'pendente';

  const isNonPrepItem = !item.requer_preparo;
  
  // Apenas Garçons e Balcões podem marcar itens SEM PREPARO como entregues
  const canDeliverNonPrep = userRole && ['garcom', 'balcao', 'superadmin', 'admin', 'gerente'].includes(userRole);
  
  // Ação de preparo/finalização é restrita à Cozinha/Gerência
  const canManagePreparation = userRole && ['cozinha', 'superadmin', 'admin', 'gerente'].includes(userRole);

  return (
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
          {item.cozinheiro && (
            <div className="flex items-center text-primary">
              <Utensils className="w-4 h-4 mr-2" />
              <span>{item.cozinheiro.nome}</span>
            </div>
          )}
          <div className={cn("flex items-center", isOverdue ? "text-destructive font-semibold" : "")}>
            <Clock className="w-4 h-4 mr-2" />
            <span>Há {tempoDesdePedido}</span>
          </div>
        </div>
        <div className="pt-2">
          {isProcessing ? (
            <Button size="sm" className="w-full" disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
            </Button>
          ) : item.status === 'pendente' ? (
            isNonPrepItem ? (
              // Item sem preparo: Garçom/Balcão pode marcar como entregue
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full bg-green-600 hover:bg-green-700 text-white" 
                onClick={() => onInitiateRecognition(item, 'entregue')} 
                disabled={!canDeliverNonPrep}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Entregar ao Cliente
              </Button>
            ) : (
              // Item com preparo: Cozinha inicia preparo (requer reconhecimento)
              <Button 
                size="sm" 
                className="w-full" 
                onClick={() => onInitiateRecognition(item, 'preparando')}
                disabled={!canManagePreparation}
              >
                <Utensils className="w-4 h-4 mr-2" />
                Iniciar Preparo
              </Button>
            )
          ) : item.status === 'preparando' && canManagePreparation ? (
            // Item em preparo: Cozinha marca como pronto (requer reconhecimento)
            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-700 text-primary-foreground" 
              onClick={() => onInitiateRecognition(item, 'entregue')}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Pronto
            </Button>
          ) : null}
          
          {/* Mensagem de restrição para Cozinha/Gerência */}
          {item.status === 'pendente' && !isNonPrepItem && !canManagePreparation && (
            <div className="mt-2 text-xs text-warning-foreground bg-warning/10 p-2 rounded-md flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
              Apenas a Cozinha/Gerência pode iniciar o preparo.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}