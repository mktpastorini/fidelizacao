import { KanbanCard } from "./KanbanCard";
import { ItemPedido } from "@/types/supabase";
import { cn } from "@/lib/utils";

type KanbanColumnProps = {
  title: string;
  items: (ItemPedido & {
    pedido: {
      mesa: { numero: number } | null;
    } | null;
    cliente: { nome: string } | null;
  })[];
  onStatusChange: (itemId: string, newStatus: 'preparando' | 'entregue') => void;
  className?: string;
};

export function KanbanColumn({ title, items, onStatusChange, className }: KanbanColumnProps) {
  return (
    <div className={cn("flex-1 bg-gray-100 rounded-lg p-4", className)}>
      <h2 className="text-xl font-bold mb-4 text-gray-700">{title} ({items.length})</h2>
      <div className="h-[calc(100vh-12rem)] overflow-y-auto pr-2">
        {items.length > 0 ? (
          items.map(item => (
            <KanbanCard key={item.id} item={item} onStatusChange={onStatusChange} />
          ))
        ) : (
          <p className="text-sm text-gray-500 text-center mt-8">Nenhum item aqui.</p>
        )}
      </div>
    </div>
  );
}