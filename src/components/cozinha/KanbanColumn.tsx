import { KanbanCard } from "./KanbanCard";
import { ItemPedido } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"; // Importado

type KanbanColumnProps = {
  title: string;
  items: (ItemPedido & {
    pedido: {
      mesa: { numero: number } | null;
    } | null;
    cliente: { nome: string } | null;
  })[];
  onStatusChange: (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string | null) => void;
  borderColor: string;
};

export function KanbanColumn({ title, items, onStatusChange, borderColor }: KanbanColumnProps) {
  return (
    <div className={cn("flex-1 bg-card rounded-lg p-4 border-t-4 flex flex-col h-full", borderColor)}>
      <h2 className="text-lg font-semibold mb-4 text-foreground shrink-0">{title} ({items.length})</h2>
      <ScrollArea className="flex-1 min-h-0">
        <div className="pr-4">
          {items.length > 0 ? (
            items.map(item => (
              <KanbanCard key={item.id} item={item} onStatusChange={onStatusChange} />
            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground text-center">Nenhum item aqui.</p>
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}