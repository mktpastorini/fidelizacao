import { useState } from "react";
import { Produto } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Utensils, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";

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
  const [observacoes, setObservacoes] = useState("");

  const handleOrderClick = () => {
    setQuantidade(1); // Reset quantity on open
    setObservacoes(""); // Reset observations
    setIsConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    if (quantidade < 1) {
      showError("A quantidade deve ser pelo menos 1.");
      return;
    }
    setIsOrdering(true);
    try {
      // NOTE: The current onOrder function does not accept observations. 
      // For now, we proceed without sending it, but the UI field is present.
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

  const total = produto.preco * quantidade;
  const hasImage = !!produto.imagem_url;

  return (
    <>
      <div
        className={cn(
          "relative rounded-lg border border-gray-300 bg-white shadow-lg cursor-pointer overflow-hidden transition-all duration-300 h-40",
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

      {/* Modal de confirmação */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900 p-0 dark:bg-gray-900 dark:text-white">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold">Adicionar ao Pedido</DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            {/* Produto Info Card e Quantidade na mesma linha */}
            <div className="flex items-start justify-between gap-4">
              {/* Produto Info Card */}
              <div className="flex items-center p-4 border rounded-lg bg-gray-100 dark:bg-gray-800 flex-1">
                <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden mr-4">
                  {hasImage ? (
                    <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Utensils className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{produto.nome}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(produto.preco)}</p>
                </div>
              </div>
              
              {/* Quantidade Selector */}
              <div className="flex flex-col items-center justify-center h-full pt-4">
                <Label htmlFor="quantidade" className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">Qtd</Label>
                <div className="flex flex-col items-center space-y-1">
                  <Button size="icon" onClick={() => handleQuantityChange(1)} disabled={isOrdering} className="w-8 h-8">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Input 
                    id="quantidade"
                    type="number" 
                    min="1" 
                    value={quantidade} 
                    onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-10 text-center h-8 p-0 bg-gray-900 text-white dark:bg-gray-700 dark:text-white border-gray-700"
                    disabled={isOrdering}
                  />
                  <Button variant="outline" size="icon" onClick={() => handleQuantityChange(-1)} disabled={quantidade <= 1 || isOrdering} className="w-8 h-8 bg-gray-300 dark:bg-gray-600 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white hover:bg-gray-400 dark:hover:bg-gray-500">
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label htmlFor="observacoes" className="text-base font-semibold">Observações (opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Ex: Sem cebola, bem passado..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="mt-2 bg-gray-900 text-white dark:bg-gray-800 dark:text-white border-gray-700"
                disabled={isOrdering}
              />
            </div>
          </div>

          {/* Footer com Total e Botões */}
          <DialogFooter className="flex flex-row items-center justify-between p-4 border-t bg-gray-100 dark:bg-gray-800">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isOrdering} className="text-gray-900 dark:text-white dark:bg-gray-700 dark:hover:bg-gray-600">
              Cancelar
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-xl font-extrabold text-primary">
                {formatCurrency(total)}
              </span>
              <Button onClick={handleConfirmOrder} disabled={isOrdering}>
                {isOrdering ? "Adicionando..." : "Adicionar ao Pedido"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}