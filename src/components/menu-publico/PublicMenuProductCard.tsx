import { useState } from "react";
import { Produto } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Utensils, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";

type PublicMenuProductCardProps = {
  produto: Produto;
  onInitiateOrder: (produto: Produto, quantidade: number, observacoes: string) => void;
  disabled?: boolean;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PublicMenuProductCard({ produto, onInitiateOrder, disabled = false }: PublicMenuProductCardProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState("");

  const isRodizioType = produto.tipo === 'rodizio' || produto.tipo === 'componente_rodizio';
  const isUnavailable = !isRodizioType && (produto.estoque_atual ?? 0) <= 0;

  const handleOrderClick = () => {
    if (isUnavailable) {
      showError("Produto indisponível no momento.");
      return;
    }
    setQuantidade(1);
    setObservacoes("");
    setIsConfirmOpen(true);
  };

  const handleConfirmOrder = () => {
    if (quantidade < 1) {
      showError("A quantidade deve ser pelo menos 1.");
      return;
    }
    onInitiateOrder(produto, quantidade, observacoes);
    setIsConfirmOpen(false);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantidade(prev => Math.max(1, prev + delta));
  };

  const total = produto.preco * quantidade;
  const hasImage = !!produto.imagem_url;

  return (
    <>
      <div
        className={cn(
          "relative group rounded-lg overflow-hidden shadow-lg cursor-pointer transition-all duration-300 aspect-[4/5] flex flex-col justify-end",
          isUnavailable && "opacity-50 cursor-not-allowed",
        )}
        onClick={handleOrderClick}
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

        {/* Badge de Esgotado */}
        {isUnavailable && (
          <Badge variant="destructive" className="absolute top-3 right-3">ESGOTADO</Badge>
        )}

        {/* Conteúdo de Texto */}
        <div className="relative p-4 text-white z-10">
          <h3 className="text-lg font-bold truncate">{produto.nome}</h3>
          <p className="text-xs text-white/80 line-clamp-2 mt-1">{produto.descricao || 'Sem descrição'}</p>
          <div className="flex justify-between items-end mt-2">
            <p className="text-xl font-extrabold">{formatCurrency(produto.preco)}</p>
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shrink-0"
              onClick={(e) => { e.stopPropagation(); handleOrderClick(); }}
              disabled={isUnavailable}
            >
              Pedir
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de confirmação */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-card text-foreground p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold text-primary">Adicionar ao Pedido</DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-secondary">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden">
                  {hasImage ? (
                    <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Utensils className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{produto.nome}</h3>
                  <p className="text-sm text-muted-foreground">{formatCurrency(produto.preco)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-1 ml-4">
                <Button variant="outline" size="icon" onClick={() => handleQuantityChange(-1)} disabled={quantidade <= 1 || isOrdering} className="w-10 h-10 bg-card border-border text-foreground hover:bg-secondary">
                  <Minus className="w-5 h-5" />
                </Button>
                <Input id="quantidade" type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 text-center h-10 p-0 bg-card text-foreground border-border" disabled={isOrdering} />
                <Button size="icon" onClick={() => handleQuantityChange(1)} disabled={isOrdering} className="w-10 h-10 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes" className="text-base font-semibold">Observações (opcional)</Label>
              <Textarea id="observacoes" placeholder="Ex: Sem cebola, bem passado..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="mt-2 bg-card text-foreground border-border placeholder-muted-foreground focus:ring-primary" disabled={isOrdering} />
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t border-border">
                <Label className="text-base font-semibold">Total:</Label>
                <span className="text-2xl font-extrabold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end p-4 border-t border-border bg-secondary gap-3">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isOrdering} className="text-foreground bg-card hover:bg-secondary border-border">
              Cancelar
            </Button>
            <Button onClick={handleConfirmOrder} disabled={isOrdering || isUnavailable} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              Adicionar ao Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}