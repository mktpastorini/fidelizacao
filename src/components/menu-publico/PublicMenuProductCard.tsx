import { useState } from "react";
import { Produto } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/utils/toast";

type PublicMenuProductCardProps = {
  produto: Produto;
  onOrder: (produto: Produto) => Promise<void>;
};

export function PublicMenuProductCard({ produto, onOrder }: PublicMenuProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  const handleOrderClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    setIsOrdering(true);
    try {
      await onOrder(produto);
      showSuccess(`Pedido de "${produto.nome}" adicionado com sucesso!`);
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
                {isOrdering ? "Enviando..." : "Pedir"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pedido</DialogTitle>
          </DialogHeader>
          <p className="p-4 text-center text-lg">Deseja adicionar <strong>{produto.nome}</strong> à sua comanda?</p>
          <DialogFooter className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={isOrdering}>Cancelar</Button>
            <Button onClick={handleConfirmOrder} disabled={isOrdering}>
              {isOrdering ? "Adicionando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}