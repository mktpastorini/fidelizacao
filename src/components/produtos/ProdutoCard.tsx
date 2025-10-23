import { Produto } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, Utensils, DollarSign, Star } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type ProdutoCardProps = {
  produto: Produto;
  onEdit: () => void;
  onDelete: () => void;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProdutoCard({ produto, onEdit, onDelete }: ProdutoCardProps) {
  // Garante que estoque_atual e alerta_estoque_baixo sejam tratados como 0 se forem null/undefined
  const estoqueAtual = produto.estoque_atual ?? 0;
  const alertaEstoqueBaixo = produto.alerta_estoque_baixo ?? 0;

  const isRodizioType = produto.tipo === 'rodizio' || produto.tipo === 'componente_rodizio';
  const isLowStock = estoqueAtual <= alertaEstoqueBaixo && estoqueAtual > 0;
  const isOutOfStock = estoqueAtual === 0;

  const getStockBadge = () => {
    if (isRodizioType) {
      return <Badge variant="secondary">Não Gerenciado</Badge>;
    }
    
    if (isOutOfStock) {
      return <Badge variant="destructive">Esgotado</Badge>;
    }
    if (isLowStock) {
      return <Badge variant="warning">Estoque Baixo ({estoqueAtual})</Badge>;
    }
    return <Badge variant="secondary">Em Estoque ({estoqueAtual})</Badge>;
  };

  return (
    <Card 
      className="group relative overflow-hidden shadow-lg transition-all hover:shadow-xl hover:border-primary/50 h-56 cursor-pointer"
      onClick={onEdit} // Ação principal: Editar
    >
      {/* Imagem de Fundo (Expansível no Hover) */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          "group-hover:opacity-100 opacity-0"
        )}
      >
        <img
          src={produto.imagem_url || '/placeholder.svg'}
          alt={produto.nome}
          className="h-full w-full object-cover"
        />
        {/* Overlay para escurecer a imagem e centralizar o botão */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <Button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }} 
            className="text-primary-foreground bg-primary hover:bg-primary/90 transition-all scale-0 group-hover:scale-100 shadow-lg"
          >
            <Edit className="w-4 h-4 mr-2" /> Editar Produto
          </Button>
        </div>
      </div>

      {/* Conteúdo Principal (Visível por padrão, some no Hover) */}
      <CardContent 
        className={cn(
          "absolute inset-0 p-4 flex flex-col justify-between transition-opacity duration-300 bg-card",
          "group-hover:opacity-0 opacity-100"
        )}
      >
        <div className="flex items-start justify-between">
          {/* Avatar do Produto */}
          <Avatar className="h-12 w-12 mr-3 shrink-0 ring-2 ring-primary/50">
            <AvatarImage src={produto.imagem_url || undefined} />
            <AvatarFallback>
              <Utensils className="h-6 w-6 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate text-lg">{produto.nome}</h3>
            <p className="text-sm text-muted-foreground truncate">{produto.descricao || 'Sem descrição'}</p>
          </div>
          
          {/* Dropdown de Ações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1 -mr-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Informações de Preço e Estoque */}
        <div className="mt-4 pt-2 border-t">
          <p className="text-2xl font-bold text-primary">{formatCurrency(produto.preco)}</p>
          {produto.valor_compra !== null && produto.valor_compra !== undefined && !isRodizioType && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Custo: {formatCurrency(produto.valor_compra)}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            {getStockBadge()}
            {produto.pontos_resgate && produto.pontos_resgate > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-primary/20 text-primary">
                    {produto.pontos_resgate} <Star className="w-3 h-3 fill-primary" />
                </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}