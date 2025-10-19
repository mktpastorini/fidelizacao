import { useState } from "react";
import { Produto } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

type PublicMenuProductCardProps = {
  produto: Produto;
  onOrder: (produto: Produto, quantidade: number) => Promise<void>;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PublicMenuProductCard({ produto, onOrder }: PublicMenuProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [quantidade, setQuantidade] = useState(1);

  const handleOrderClick = () => {
    setQuantidade(1); // Reset quantity on open
    setIsConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (quantidade < 1) {
      showError("A quantidade deve ser pelo menos 1.");
      return;
    }
    setIsOrdering(true);
    try {
      await onOrder(produto, quantidade);
      showSuccess(`Pedido de ${quantidade}x "${produto.nome}" adicionado com sucesso!`);
      setIsConfirmOpen(false);
    } catch (error: any) {
      showError(error.message || "Erro ao adicionar pedido.");
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "relative rounded-lg border border-gray-700 bg-gray-800 shadow-lg cursor-pointer overflow-hidden transition-all duration-300",
          isHovered ? "scale-[1.02] shadow-xl" : "scale-100"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleOrderClick}
      >
        {/* Conteúdo Padrão (Imagem Pequena + Info) */}
        <div className="p-3 flex items-center gap-3">
          <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-gray-700 flex items-center justify-center">
            {produto.imagem_url ? (
              <img
                src={produto.imagem_url}
                alt={produto.nome}
                className="w-full h-full object-cover"
              />
            ) : (
              <Utensils className="w-6 h-6 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white truncate">{produto.nome}</h3>
            <p className="text-sm font-bold text-primary mt-1">{formatCurrency(produto.preco)}</p>
          </div>
        </div>

        {/* Overlay de Hover (Imagem Cheia + Botão) */}
        {isHovered && (
          <div className="absolute inset-0 z-10 bg-black/80 flex flex-col items-center justify-center p-4 text-white transition-opacity duration-300">
            {produto.imagem_url && (
              <img
                src={produto.imagem_url}
                alt={produto.nome}
                className="absolute inset-0 w-full h-full object-cover opacity-30"
                aria-hidden="true"
              />
            )}
            <div className="relative z-20 text-center space-y-3">
              <h3 className="text-xl font-bold">{produto.nome}</h3>
              <p className="text-lg font-bold text-primary">{formatCurrency(produto.preco)}</p>
              <Button onClick={handleOrderClick} disabled={isOrdering} size="lg" variant="secondary" className="mt-2">
                Pedir
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>Adicionar ao Pedido</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <p className="text-lg">Item: <strong>{produto.nome}</strong></p>
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input 
                id="quantidade"
                type="number" 
                min="1" 
                value={quantidade} 
                onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))} 
                className="w-full"
              />
            </div>
            <p className="text-xl font-bold text-right">Total: {formatCurrency(produto.preco * quantidade)}</p>
          </div>
          <DialogFooter className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isOrdering}>Cancelar</Button>
            <Button onClick={handleConfirmOrder} disabled={isOrdering}>
              {isOrdering ? "Adicionando..." : "Confirmar Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}