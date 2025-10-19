import { Produto } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ProdutoCardProps = {
  produto: Produto;
  onEdit: () => void;
  onDelete: () => void;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProdutoCard({ produto, onEdit, onDelete }: ProdutoCardProps) {
  return (
    <Card className="group overflow-hidden shadow-sm transition-all hover:shadow-xl">
      <div className="relative h-40 overflow-hidden">
        <img
          src={produto.imagem_url || '/placeholder.svg'}
          alt={produto.nome}
          className="h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
        />
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate text-lg">{produto.nome}</h3>
            <p className="text-sm text-muted-foreground truncate">{produto.descricao || 'Sem descrição'}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mt-1 -mr-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-primary">{formatCurrency(produto.preco)}</p>
        </div>
      </CardContent>
    </Card>
  );
}