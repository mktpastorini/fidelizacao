import { ItemPedido } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Utensils } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const tempoDesdePedido = formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true });

  return (
    <Card className="mb-4 shadow-md">
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-lg font-bold">{item.nome_produto} (x{item.quantidade})</h3>
          <p className="text-sm font-semibold text-blue-600">Mesa {item.pedido?.mesa?.numero || '?'}</p>
        </div>
        <div className="text-sm text-gray-600 space-y-1 border-t pt-2">
          <div className="flex items-center">
            <User className="w-4 h-4 mr-2" />
            <span>Para: {item.cliente?.nome || "Mesa (Geral)"}</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            <span>Pedido {tempoDesdePedido}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {item.status === 'pendente' && (
            <Button size="sm" onClick={() => onStatusChange(item.id, 'preparando')}>
              <Utensils className="w-4 h-4 mr-2" />
              Preparar
            </Button>
          )}
          {item.status === 'preparando' && (
            <Button size="sm" variant="success" onClick={() => onStatusChange(item.id, 'entregue')}>
              Finalizar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}