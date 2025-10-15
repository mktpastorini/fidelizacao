import { Mesa, Pedido, ItemPedido } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Users, User, Clock, DollarSign } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type MesaComPedido = Mesa & {
  pedido?: (Pedido & { itens_pedido: ItemPedido[] }) | null;
};

type MesaCardProps = {
  mesa: MesaComPedido;
  ocupantesCount: number;
  onClick: () => void;
  children: React.ReactNode;
};

export function MesaCard({ mesa, ocupantesCount, onClick, children }: MesaCardProps) {
  const isOcupada = !!mesa.cliente;
  
  const pedidoTotal = mesa.pedido?.itens_pedido.reduce((acc, item) => {
    const precoTotal = (item.preco || 0) * item.quantidade;
    const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
    return acc + (precoTotal - desconto);
  }, 0) || 0;

  const tempoOcupada = isOcupada && mesa.pedido?.created_at
    ? formatDistanceToNow(new Date(mesa.pedido.created_at), { locale: ptBR })
    : null;
  
  const hasPendingItems = mesa.pedido?.itens_pedido.some(item => item.status === 'pendente' || item.status === 'preparando');

  return (
    <Card
      className={cn(
        "shadow-md transition-all hover:shadow-lg cursor-pointer flex flex-col justify-between",
        isOcupada ? "bg-card" : "bg-secondary/50",
        hasPendingItems && "border-accent ring-2 ring-accent/50"
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div onClick={onClick} className="flex-1">
          <CardTitle className="text-2xl font-bold">Mesa {mesa.numero}</CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
            <Users className="w-3 h-3" />
            <span>{ocupantesCount} / {mesa.capacidade}</span>
          </div>
        </div>
        {children}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end" onClick={onClick}>
        {isOcupada ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <User className="w-4 h-4" />
              <span className="truncate">{mesa.cliente?.nome}</span>
            </div>
            <div className="flex items-center text-muted-foreground text-xs gap-2">
              <Clock className="w-3 h-3" />
              <span>{tempoOcupada}</span>
            </div>
            <div className="flex items-center text-muted-foreground text-xs gap-2">
              <DollarSign className="w-3 h-3" />
              <span>R$ {pedidoTotal.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-green-600">Livre</p>
        )}
      </CardContent>
    </Card>
  );
}