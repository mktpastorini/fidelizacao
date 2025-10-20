import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Produto } from "@/types/supabase";

type ProdutoCardProps = {
  produto: Produto;
  onEdit: () => void;
};

export function ProdutoCard({ produto, onEdit }: ProdutoCardProps) {
  return (
    <Card className="relative cursor-pointer" onClick={onEdit}>
      {/* Conteúdo Principal (Visível por padrão, some no Hover) */}
      <CardContent
        className={cn(
          "absolute inset-0 p-4 flex flex-col justify-between transition-opacity duration-300 bg-card",
          "opacity-100 hover:opacity-0"
        )}
      >
        <div>
          <CardTitle className="text-lg font-bold">{produto.nome}</CardTitle>
          <p className="text-sm text-muted-foreground">{produto.descricao}</p>
        </div>
        <div className="text-right font-semibold">{produto.preco?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
      </CardContent>

      {/* Conteúdo Hover (Visível ao passar o mouse) */}
      <CardContent
        className={cn(
          "p-4 flex flex-col justify-between transition-opacity duration-300 bg-card",
          "opacity-0 hover:opacity-100"
        )}
      >
        <div>
          <CardTitle className="text-lg font-bold">{produto.nome}</CardTitle>
          <p className="text-sm text-muted-foreground">{produto.descricao}</p>
        </div>
        <div className="text-right font-semibold">{produto.preco?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
      </CardContent>
    </Card>
  );
}