import { ItemPedido } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Utensils, CheckCircle } from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

type KanbanCardProps = {
  item: ItemPedido & {
    pedido: {
      mesa: { numero: number } | null;
    } | null;
    cliente: { nome: string } | null;
  };
  onStatusChange: (itemId: string, newStatus: 'preparando' | 'entregue') => void;
};

export function KanbanCard({ item, onStatusChange }: KanbanCardProps) {
  const now = new Date();
  const createdAt = new Date(item.created_at);
  const tempoDesdePedido = formatDistanceToNow(createdAt, { locale: ptBR });
  const minutesSinceCreation = differenceInMinutes(now, createdAt);

  const isOverdue = minutesSinceCreation > 5 && item.status === 'pendente';

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
          <div className={cn("flex items-center", isOverdue ? "text-red-500 font-semibold" : "")}>
            <Clock className="w-4 h-4 mr-2" />
            <span>Há {tempoDesdePedido}</span>
          </div>
        </div>
        <div className="pt-2">
          {item.status === 'pendente' && (
            item.requer_preparo ? (
              <Button size="sm" className="w-full" onClick={() => onStatusChange(item.id, 'preparando')}>
                <Utensils className="w-4 h-4 mr-2" />
                Preparar
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="w-full" onClick={() => onStatusChange(item.id, 'entregue')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Entregar
              </Button>
            )
          )}
          {item.status === 'preparando' && (
            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => onStatusChange(item.id, 'entregue')}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Pronto
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}