import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Produto } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Utensils, PlusCircle, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type ResgatePontosDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ocupantes: Cliente[]; // Agora recebe todos os ocupantes
  mesaId: string | null;
  produtosResgatáveis: Produto[];
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ResgatePontosDialog({
  isOpen,
  onOpenChange,
  ocupantes,
  mesaId,
  produtosResgatáveis,
}: ResgatePontosDialogProps) {
  const queryClient = useQueryClient();
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState(1);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedClienteId(ocupantes.length > 0 ? ocupantes[0].id : null);
      setSelectedProduto(null);
      setQuantidade(1);
    }
  }, [isOpen, ocupantes]);

  const uniqueOcupantes = useMemo(() => {
    if (!ocupantes) return [];
    const map = new Map<string, Cliente>();
    for (const ocupante of ocupantes) {
        if (ocupante && ocupante.id) {
            map.set(ocupante.id, ocupante);
        }
    }
    return Array.from(map.values());
  }, [ocupantes]);

  const clienteResgatando = useMemo(() => {
    return ocupantes.find(c => c.id === selectedClienteId) || null;
  }, [ocupantes, selectedClienteId]);

  const produtosDisponiveis = useMemo(() => {
    return produtosResgatáveis.filter(p => p.pontos_resgate && p.pontos_resgate > 0);
  }, [produtosResgatáveis]);

  const pontosDisponiveis = clienteResgatando?.pontos || 0;
  const pontosNecessarios = selectedProduto?.pontos_resgate ? selectedProduto.pontos_resgate * quantidade : 0;
  const podeResgatar = !!clienteResgatando && pontosDisponiveis >= pontosNecessarios && !!selectedProduto;

  const resgateMutation = useMutation({
    mutationFn: async () => {
      if (!clienteResgatando || !mesaId || !selectedProduto || !selectedProduto.pontos_resgate) {
        throw new Error("Dados incompletos para o resgate.");
      }
      if (!podeResgatar) {
        throw new Error("Pontos insuficientes para este resgate.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado.");

      // 1. Encontrar ou criar o pedido aberto
      let pedidoId: string | null = null;
      const { data: existingPedido, error: existingPedidoError } = await supabase
        .from("pedidos")
        .select("id")
        .eq("mesa_id", mesaId)
        .eq("status", "aberto")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPedidoError) throw existingPedidoError;
      
      if (existingPedido) {
        pedidoId = existingPedido.id;
      } else {
        const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
          mesa_id: mesaId,
          cliente_id: clienteResgatando.id, // Usa o cliente que está resgatando como principal se for novo pedido
          user_id: user.id,
          status: "aberto",
        }).select("id").single();
        if (newPedidoError) throw newPedidoError;
        pedidoId = newPedido.id;
      }

      // 2. Inserir o item de resgate (preço original, com desconto de 100%)
      const { error: itemError } = await supabase.from("itens_pedido").insert({
        pedido_id: pedidoId,
        user_id: user.id,
        nome_produto: `[RESGATE] ${selectedProduto.nome}`,
        quantidade: quantidade,
        preco: selectedProduto.preco, // Mantemos o preço original para fins de relatório, mas aplicamos 100% de desconto
        consumido_por_cliente_id: clienteResgatando.id,
        desconto_percentual: 100,
        desconto_motivo: `Resgate de ${pontosNecessarios} pontos`,
        status: "pendente",
        requer_preparo: selectedProduto.requer_preparo,
      });
      if (itemError) throw itemError;

      // 3. Deduzir os pontos do cliente
      const { error: pointsError } = await supabase.from("clientes")
        .update({ pontos: pontosDisponiveis - pontosNecessarios })
        .eq("id", clienteResgatando.id);
      if (pointsError) throw pointsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesaId] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess(`Resgate de ${quantidade}x ${selectedProduto?.nome} realizado com sucesso!`);
      setSelectedProduto(null);
      setQuantidade(1);
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleSelectProduct = (produto: Produto) => {
    setSelectedProduto(produto);
    setQuantidade(1);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantidade(prev => Math.max(1, prev + delta));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resgate de Pontos Fidelidade</DialogTitle>
          <DialogDescription>
            Selecione o cliente e o prêmio para resgate.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Coluna de Produtos Resgatáveis */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center"><Star className="w-5 h-5 mr-2 text-yellow-500" /> Prêmios Disponíveis</h3>
            <ScrollArea className="h-96 pr-2">
              <div className="space-y-3">
                {produtosDisponiveis.length > 0 ? (
                  produtosDisponiveis.map(produto => (
                    <Card 
                      key={produto.id} 
                      className={cn(
                        "cursor-pointer transition-all border-2",
                        selectedProduto?.id === produto.id ? "border-primary ring-2 ring-primary/50" : "border-border hover:border-secondary"
                      )}
                      onClick={() => handleSelectProduct(produto)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-12 h-12 shrink-0 rounded-md overflow-hidden bg-secondary flex items-center justify-center">
                          {produto.imagem_url ? (
                            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
                          ) : (
                            <Utensils className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{produto.nome}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(produto.preco)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-primary flex items-center">
                            {produto.pontos_resgate} <Star className="w-4 h-4 ml-1 fill-yellow-500 text-yellow-500" />
                          </p>
                          <p className="text-xs text-muted-foreground">pontos</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">Nenhum produto configurado para resgate.</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Coluna de Confirmação */}
          <div className="space-y-4 p-4 border rounded-lg bg-secondary">
            <h3 className="font-semibold text-lg">Confirmação de Resgate</h3>
            
            {/* Seletor de Cliente */}
            <div>
              <Label htmlFor="cliente-resgate">Cliente Resgatando</Label>
              <Select 
                value={selectedClienteId || ''} 
                onValueChange={setSelectedClienteId}
                disabled={uniqueOcupantes.length === 0}
              >
                <SelectTrigger id="cliente-resgate" className="mt-1">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueOcupantes.map(cliente => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome} ({cliente.pontos} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {clienteResgatando ? (
              <div className="space-y-4">
                <Card className="p-4">
                  <p className="font-bold text-xl">{selectedProduto?.nome || 'Selecione um produto'}</p>
                  <p className="text-sm text-muted-foreground">Custo: {selectedProduto?.pontos_resgate || 0} pontos</p>
                </Card>

                <div>
                  <label className="text-sm font-medium">Quantidade</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => handleQuantityChange(-1)} 
                      disabled={quantidade <= 1 || resgateMutation.isPending}
                    >
                      -
                    </Button>
                    <Input 
                      type="number" 
                      min="1" 
                      value={quantidade} 
                      onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))} 
                      className="w-16 text-center"
                      disabled={resgateMutation.isPending}
                    />
                    <Button 
                      size="icon" 
                      onClick={() => handleQuantityChange(1)} 
                      disabled={resgateMutation.isPending}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-1">
                  <p className="text-sm font-medium">Pontos do Cliente: <span className="font-bold text-primary">{pontosDisponiveis}</span></p>
                  <p className="text-sm font-medium">Pontos Necessários: <span className={cn("font-bold", podeResgatar ? "text-green-600" : "text-destructive")}>{pontosNecessarios}</span></p>
                  <p className="text-sm font-medium">Pontos Restantes: <span className="font-bold">{pontosDisponiveis - pontosNecessarios}</span></p>
                </div>

                <Button 
                  onClick={() => resgateMutation.mutate()} 
                  disabled={!podeResgatar || resgateMutation.isPending} 
                  className="w-full"
                >
                  {resgateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                  {resgateMutation.isPending ? "Resgatando..." : `Confirmar Resgate (${pontosNecessarios} pts)`}
                </Button>
                {!podeResgatar && <p className="text-destructive text-sm text-center">Pontos insuficientes ou produto não selecionado.</p>}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-12">Selecione um cliente e um prêmio para resgatar.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}