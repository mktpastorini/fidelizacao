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
  onInitiateOrder: (produto: Produto, quantidade: number, observacoes: string) => void;
  disabled?: boolean;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PublicMenuProductCard({ produto, onInitiateOrder, disabled = false }: PublicMenuProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [quantidade, setQuantidade] = useState(1);
  const [observacoes, setObservacoes] = useState("");

  // Lógica de disponibilidade: Se for tipo venda E estoque for 0, está indisponível.
  const isRodizioType = produto.tipo === 'rodizio' || produto.tipo === 'componente_rodizio';
  const isUnavailable = !isRodizioType && (produto.estoque_atual ?? 0) <= 0;

  const handleOrderClick = () => {
    if (isUnavailable) {
      showError("Produto indisponível no momento.");
      return;
    }
    setQuantidade(1); // Reset quantity on open
    setObservacoes(""); // Reset observations
    setIsConfirmOpen(true);
  };

  const handleConfirmOrder = () => {
    if (quantidade < 1) {
      showError("A quantidade deve ser pelo menos 1.");
      return;
    }
    // Em vez de fazer o pedido, chamamos a função para iniciar o fluxo de identificação
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
          "relative rounded-lg border border-gray-300 bg-white shadow-lg cursor-pointer overflow-hidden transition-all duration-300 h-40",
          isUnavailable && "opacity-50 cursor-not-allowed", // Usando isUnavailable aqui
          isHovered ? "scale-[1.02] shadow-xl" : "scale-100",
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
                {isUnavailable && <p className="text-red-400 font-semibold mt-2">Indisponível</p>}
                {!isUnavailable && <p className="text-sm mt-2">Clique para Pedir</p>}
            </div>
        </div>

        {/* Conteúdo Padrão (Visível quando não está em hover) */}
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
            {isUnavailable && <p className="text-red-500 font-semibold mt-1">Indisponível</p>}
          </div>
        </div>
      </div>

      {/* Modal de confirmação */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900 p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-bold">Adicionar ao Pedido</DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            {/* Bloco de Produto e Quantidade */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
              {/* Produto Info */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden">
                  {hasImage ? (
                    <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Utensils className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{produto.nome}</h3>
                  <p className="text-sm text-gray-600">{formatCurrency(produto.preco)}</p>
                </div>
              </div>
              
              {/* Quantidade Selector */}
              <div className="flex items-center space-x-1 ml-4">
                {/* Botão de menos (cinza) */}
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => handleQuantityChange(-1)} 
                  disabled={quantidade <= 1 || isOrdering} 
                  className="w-10 h-10 bg-gray-300 border-gray-400 text-gray-900 hover:bg-gray-400"
                >
                  <Minus className="w-5 h-5" />
                </Button>
                {/* Input de quantidade (preto) */}
                <Input 
                  id="quantidade"
                  type="number" 
                  min="1" 
                  value={quantidade} 
                  onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))} 
                  className="w-10 text-center h-10 p-0 bg-gray-900 text-white border-gray-900"
                  disabled={isOrdering}
                />
                {/* Botão de mais (azul) */}
                <Button 
                  size="icon" 
                  onClick={() => handleQuantityChange(1)} 
                  disabled={isOrdering} 
                  className="w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Plus className="w-5 h-5" />
                </Button>
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
                className="mt-2 bg-gray-900 text-white border-gray-900 placeholder-gray-400 focus:ring-blue-500"
                disabled={isOrdering}
              />
            </div>
            
            {/* Total Display */}
            <div className="flex items-center justify-between pt-2">
                <Label className="text-base font-semibold">Total:</Label>
                <span className="text-xl font-extrabold text-gray-900">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Footer com Botões */}
          <DialogFooter className="flex flex-row items-center justify-end p-4 border-t bg-gray-100 gap-3">
            {/* Botão Cancelar (Preto) */}
            <Button 
              variant="outline" 
              onClick={() => setIsConfirmOpen(false)} 
              disabled={isOrdering} 
              className="text-white bg-gray-900 hover:bg-gray-800 border-gray-900 hover:text-white"
            >
              Cancelar
            </Button>
            {/* Botão Adicionar (Azul) */}
            <Button 
              onClick={handleConfirmOrder} 
              disabled={isOrdering || isUnavailable}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Adicionar ao Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}