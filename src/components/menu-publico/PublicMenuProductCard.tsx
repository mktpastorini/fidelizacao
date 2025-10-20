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

export function PublicMenuProductCard({ produto, onOrder }: PublicMenuProductCardCardProps) {
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

  const handleQuantityChange = (delta: number) => {
    setQuantidade(prev => Math.max(1, prev + delta));
  };

  // Determine if the product has an image
  const hasImage = !!produto.imagem_url;

  return (
    <>
      <div
        className={cn(
          "relative rounded-lg border border-gray-300 bg-white shadow-lg cursor-pointer overflow-hidden transition-all duration-300 h-40", // Fixed height for better visual consistency
          isHovered ? "scale-[1.02] shadow-xl" : "scale-100"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleOrderClick}
      >
        {/* Image filling the card on hover */}
        <div className={cn(
            "absolute inset-0 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
        )}>
            {hasImage ? (
                <img
                    src={produto.imagem_url}
                    alt={produto.nome}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <Utensils className="w-12 h-12 text-gray-500" />
                </div>
            )}
            {/* Overlay for text visibility and interaction prompt */}
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 text-white">
                <h3 className="text-xl font-bold text-center">{produto.nome}</h3>
                <p className="text-lg font-bold text-primary mt-1">{formatCurrency(produto.preco)}</p>
                <p className="text-sm mt-2">Clique para Pedir</p>
            </div>
        </div>

        {/* Content Padrão (Visível quando não está em hover) */}
        <div className={cn(
          "p-3 flex items-center gap-3 transition-opacity duration-300 h-full",
          isHovered ? "opacity-0" : "opacity-100"
        )}>
          <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
            {hasImage ? (
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
            <h3 className="text-base font-semibold text-gray-900 truncate">{produto.nome}</h3>
            <p className="text-sm text-gray-600 truncate">{produto.descricao || 'Sem descrição'}</p>
            <p className="text-sm font-bold text-primary mt-1">{formatCurrency(produto.preco)}</p>
          </div>
        </div>
      </div>

      {/* Modal de confirmação (Updated to include quantity controls) */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>Adicionar ao Pedido</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <p className="text-lg">Item: <strong>{produto.nome}</strong></p>
            <div className="flex justify-between items-center">
                <Label htmlFor="quantidade" className="text-base">Quantidade</Label>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleQuantityChange(-1)} disabled={quantidade <= 1 || isOrdering}>-</Button>
                    <Input 
                        id="quantidade"
                        type="number" 
                        min="1" 
                        value={quantidade} 
                        onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))} 
                        className="w-16 text-center"
                        disabled={isOrdering}
                    />
                    <Button variant="outline" size="icon" onClick={() => handleQuantityChange(1)} disabled={isOrdering}>+</Button>
                </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-xl font-bold">Total:</span>
                <span className="text-2xl font-extrabold text-primary">{formatCurrency(produto.preco * quantidade)}</span>
            </div>
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