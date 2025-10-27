import { Produto } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Utensils, DollarSign, Star } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProdutoCardProps = {
  produto: Produto;
  onEdit: () => void;
  onDelete: () => void;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProdutoCard({ produto, onEdit, onDelete }: ProdutoCardProps) {
  const estoqueAtual = produto.estoque_atual ?? 0;
  const alertaEstoqueBaixo = produto.alerta_estoque_baixo ?? 0;

  const isRodizioType = produto.tipo === 'rodizio' || produto.tipo === 'componente_rodizio';
  const isLowStock = estoqueAtual <= alertaEstoqueBaixo && estoqueAtual > 0;
  const isOutOfStock = estoqueAtual === 0;

  const getStockBadge = () => {
    if (isRodizioType) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Não Gerenciado</Badge>;
    }
    if (isOutOfStock) {
      return <Badge variant="destructive">Esgotado</Badge>;
    }
    if (isLowStock) {
      return <Badge variant="warning">Estoque Baixo ({estoqueAtual})</Badge>;
    }
    return <Badge variant="secondary">Em Estoque ({estoqueAtual})</Badge>;
  };

  const hasImage = !!produto.imagem_url;

  return (
    <div
      className="relative group rounded-lg overflow-hidden shadow-lg cursor-pointer transition-all duration-300 aspect-[4/5] flex flex-col justify-end"
      onClick={onEdit}
    >
      {/* Imagem de Fundo */}
      {hasImage ? (
        <img
          src={produto.imagem_url}
          alt={produto.nome}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-secondary flex items-center justify-center">
          <Utensils className="w-12 h-12 text-muted-foreground" />
        </div>
      )}

      {/* Overlay de Gradiente */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Dropdown de Ações */}
      <div className="absolute top-2 right-2 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70" onClick={e => e.stopPropagation()}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onEdit}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Badges de Status */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 items-start">
        {getStockBadge()}
        {produto.pontos_resgate && produto.pontos_resgate > 0 && (
          <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-400 text-yellow-900">
            {produto.pontos_resgate} <Star className="w-3 h-3" />
          </Badge>
        )}
      </div>

      {/* Conteúdo de Texto */}
      <div className="relative p-4 text-white z-10">
        <h3 className="text-lg font-bold truncate">{produto.nome}</h3>
        <div className="flex justify-between items-end mt-2">
          <p className="text-xl font-extrabold">{formatCurrency(produto.preco)}</p>
          {produto.valor_compra !== null && produto.valor_compra !== undefined && !isRodizioType && (
            <p className="text-xs text-white/70 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Custo: {formatCurrency(produto.valor_compra)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}