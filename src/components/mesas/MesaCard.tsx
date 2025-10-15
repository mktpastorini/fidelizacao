import { Mesa, Pedido, ItemPedido } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Users, User, Clock, DollarSign } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Ocupante = { cliente: { id: string; nome: string } | null };
type MesaComPedido = Mesa & {
  ocupantes: Ocupante[];
  pedido?: (Pedido & { itens_pedido: ItemPedido[] }) | null;
};

type MesaCardProps = {
  mesa: MesaComPedido;
  onClick: () => void;
};

export function MesaCard({ mesa, onClick }: MesaCardProps) {
  const isOcupada = !!mesa.cliente;
  const acompanhantes = (mesa.ocupantes || [])
    .map(o => o.cliente?.nome)
    .filter(Boolean) as string[];
  
  const acompanhantesCount = acompanhantes.length > 1 ? acompanhantes.length - 1 : 0;

  const pedidoTotal = mesa.pedido?.itens_pedido.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0) || 0;
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
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-2xl font-bold">Mesa {mesa.numero}</CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
            <Users className="w-3 h-3" />
            <span>{acompanhantes.length} / {mesa.capacidade}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end">
        {isOcupada ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <User className="w-4 h-4" />
              <span>{mesa.cliente?.nome}</span>
              {acompanhantesCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-pointer">(+{acompanhantesCount})</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">Acompanhantes:</p>
                      <ul className="list-disc list-inside">
                        {acompanhantes.filter(nome => nome !== mesa.cliente?.nome).map((nome, index) => (
                          <li key={index}>{nome}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
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