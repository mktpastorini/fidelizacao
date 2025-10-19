import { useState } from "react";
import { Produto } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicMenuProductCardProps = {
  produto: Produto;
  onOrder: (produto: Produto, quantidade: number) => Promise<void>;
};

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

  return (
    <>
      <div
        className="relative rounded-lg border border-gray-200 bg-white shadow-sm cursor-pointer overflow-hidden transition"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Conteúdo do card */}
        <div className="p-4 min-h-[140px] flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 truncate">{produto.nome}</h3>
            {produto.descricao && <p className="text-sm text-gray-500 truncate">{produto.descricao}</p>}
          </div>
          <div className="mt-4 text-xl font-bold text-gray-900">R$ {produto.preco.toFixed(2).replace('.', ',')}</div>
        </div>

        {/* Imagem que preenche o card ao hover */}
        {isHovered && produto.imagem_url && (
          <div className="absolute inset-0 z-10 bg-black bg-opacity-70 flex flex-col items-center justify-center p-4 text-white transition-opacity">
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-80"
              aria-hidden="true"
            />
            <div className="relative z-20">
              <Button onClick={handleOrderClick} disabled={isOrdering} size="lg" variant="secondary">
                Pedir
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
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
            <p className="text-xl font-bold text-right">Total: R$ {(produto.preco * quantidade).toFixed(2).replace('.', ',')}</p>
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