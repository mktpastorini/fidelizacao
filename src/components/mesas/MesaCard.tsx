import { Mesa, Pedido, ItemPedido } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, User, Clock, DollarSign, MoreVertical, QrCode, UserMinus, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QRCodeModal } from "./QRCodeModal";

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

type MesaComPedido = Mesa & {
  pedido?: (Pedido & { itens_pedido: ItemPedido[] }) | null;
};

type MesaCardProps = {
  mesa: MesaComPedido;
  ocupantesCount: number;
  onClick: () => void;
  onEditMesa: () => void;
  onFreeMesa: () => void;
  onEditOcupantes: () => void;
  onDelete: () => void; // Adicionado prop onDelete
  children?: React.ReactNode;
};

export function MesaCard({ mesa, ocupantesCount, onClick, onEditMesa, onFreeMesa, onEditOcupantes, onDelete, children }: MesaCardProps) {
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);

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

  // URL pública do menu para a mesa
  const qrCodeUrl = `${window.location.origin}/menu-publico/${mesa.id}`;

  return (
    <>
      <Card
        className={cn(
          "border transition-all hover:border-primary/50 cursor-pointer flex flex-col justify-between shadow-lg",
          isOcupada ? "bg-card" : "bg-secondary/50",
          hasPendingItems && "border-warning ring-2 ring-warning/50" // Usando warning para itens pendentes
        )}
        onClick={onClick} // Mover onClick para o Card principal para garantir captura do clique
      >
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle className="text-2xl font-bold text-primary">Mesa {mesa.numero}</CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
              <Users className="w-3 h-3" />
              <span>{ocupantesCount} / {mesa.capacidade}</span>
            </div>
          </div>
          <div>
            {children}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Menu da Mesa"
                  className="p-1 rounded hover:bg-muted transition-colors"
                  onClick={e => e.stopPropagation()} // Evita que o clique no menu feche o modal
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                {mesa.cliente_id && (
                  <>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onClick(); }}>
                      <Users className="w-4 h-4 mr-2" /> Ver Detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEditOcupantes(); }}>
                      <Users className="w-4 h-4 mr-2" /> Editar Ocupantes
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onFreeMesa(); }}>
                      <UserMinus className="w-4 h-4 mr-2" /> Liberar Mesa
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsQRCodeOpen(true); }}>
                  <QrCode className="w-4 h-4 mr-2" /> Visualizar QR Code
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEditMesa(); }}>
                  <Edit className="w-4 h-4 mr-2" /> Editar Mesa
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => { e.preventDefault(); onDelete(); }}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Mesa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-end">
          {isOcupada ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <User className="w-4 h-4 text-primary" />
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
            <p className="text-sm font-semibold text-success">Livre</p>
          )}
        </CardContent>
      </Card>
      <QRCodeModal
        isOpen={isQRCodeOpen}
        onOpenChange={setIsQRCodeOpen}
        mesaNumero={mesa.numero}
        qrCodeUrl={qrCodeUrl}
      />
    </>
  );
}