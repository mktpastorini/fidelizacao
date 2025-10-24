import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Pedido, ItemPedido, Cliente, StaffProfile, Produto } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, Utensils, Trash2, PlusCircle, CheckCircle, XCircle, Tag, Star, Loader2, User, Minus } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { AplicarDescontoDialog } from "./AplicarDescontoDialog";
import { ResgatePontosDialog } from "./ResgatePontosDialog";
import { FinalizarContaParcialDialog } from "./FinalizarContaParcialDialog";
import { FinalizarContaTotalDialog } from "./FinalizarContaTotalDialog";
import { useApprovalRequest } from "@/hooks/useApprovalRequest";
import { useSuperadminId } from "@/hooks/useSuperadminId";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type MesaComPedido = Mesa & {
  pedido?: (Pedido & { itens_pedido: ItemPedido[] }) | null;
};

type PedidoModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesa: Mesa | null;
};

type PedidoData = {
  pedido: (Pedido & { itens_pedido: ItemPedido[] }) | null;
  ocupantes: Cliente[];
  produtos: Produto[];
  staffProfiles: StaffProfile[];
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

async function fetchPedidoData(mesaId: string, superadminId: string | null): Promise<PedidoData> {
  if (!superadminId) throw new Error("ID do Superadmin não encontrado.");
  
  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .order("created_at", { foreignTable: "itens_pedido", ascending: true })
    .maybeSingle();

  if (pedidoError && pedidoError.code !== 'PGRST116') throw pedidoError;

  let ocupantes: Cliente[] = [];
  if (pedido) {
    const { data: ocupanteIds, error: idsError } = await supabase.from("mesa_ocupantes").select("cliente_id").eq("mesa_id", mesaId);
    if (idsError) throw idsError;

    const ids = ocupanteIds.map(o => o.cliente_id);
    if (ids.length > 0) {
      const { data: clientes, error: clientesError } = await supabase.from("clientes").select("*, filhos(*), indicado_por:clientes!indicado_por_id(nome)").in("id", ids);
      if (clientesError) throw clientesError;
      ocupantes = clientes || [];
    }
  }
  
  const { data: produtos, error: produtosError } = await supabase.from("produtos").select("*").eq("user_id", superadminId).order("nome");
  if (produtosError) throw produtosError;
  
  // Busca perfis de staff para seleção de garçom
  const { data: staffProfiles, error: staffError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("role", ['garcom', 'balcao', 'admin', 'gerente', 'superadmin']);
  if (staffError) throw staffError;

  return { pedido: pedido as (Pedido & { itens_pedido: ItemPedido[] }) | null, ocupantes, produtos: produtos || [], staffProfiles: staffProfiles as StaffProfile[] || [] };
}

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  const queryClient = useQueryClient();
  const { requestApproval, isRequesting } = useApprovalRequest();
  const { superadminId, isLoadingSuperadminId } = useSuperadminId();
  
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [itemToDiscount, setItemToDiscount] = useState<ItemPedido | null>(null);
  const [isResgateOpen, setIsResgateOpen] = useState(false);
  const [isPartialPaymentOpen, setIsPartialPaymentOpen] = useState(false);
  const [isTotalPaymentOpen, setIsTotalPaymentOpen] = useState(false);
  const [clienteToPay, setClienteToPay] = useState<Cliente | null>(null);

  const isQueryEnabled = !!mesa?.id && !!superadminId && !isLoadingSuperadminId;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pedidoAberto", mesa?.id, superadminId],
    queryFn: () => fetchPedidoData(mesa!.id, superadminId!),
    enabled: isQueryEnabled,
    refetchInterval: 10000,
  });

  const pedido = data?.pedido;
  const ocupantes = data?.ocupantes || [];
  const produtos = data?.produtos || [];
  const staffProfiles = data?.staffProfiles || [];
  
  const ocupantesMap = useMemo(() => {
    const map = new Map<string, Cliente>();
    ocupantes.forEach(c => map.set(c.id, c));
    return map;
  }, [ocupantes]);

  const itensPorConsumidor = useMemo(() => {
    const map = new Map<string, ItemPedido[]>();
    const mesaGeralId = 'mesa_geral';

    if (pedido) {
      pedido.itens_pedido.forEach(item => {
        const consumidorId = item.consumido_por_cliente_id || mesaGeralId;
        if (!map.has(consumidorId)) {
          map.set(consumidorId, []);
        }
        map.get(consumidorId)?.push(item);
      });
    }
    return map;
  }, [pedido]);

  const subtotalItens = useMemo(() => {
    return pedido?.itens_pedido.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0) || 0;
  }, [pedido]);

  const totalGorjeta = pedido?.gorjeta_valor || 0;
  const totalFinal = subtotalItens + totalGorjeta;
  
  const produtosResgatáveis = useMemo(() => {
    return produtos.filter(p => p.pontos_resgate && p.pontos_resgate > 0);
  }, [produtos]);

  const handleDiscountRequest = (item: ItemPedido) => {
    setItemToDiscount(item);
    setIsDiscountOpen(true);
  };

  const handlePartialPaymentOpen = (cliente: Cliente) => {
    setClienteToPay(cliente);
    setIsPartialPaymentOpen(true);
  };

  const handleTotalPaymentOpen = () => {
    setIsTotalPaymentOpen(true);
  };

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("itens_pedido").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess("Item removido!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const updateItemQuantityMutation = useMutation({
    mutationFn: async ({ itemId, newQuantity }: { itemId: string; newQuantity: number }) => {
      const { error } = await supabase.from("itens_pedido").update({ quantidade: newQuantity }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
    },
    onError: (err: Error) => showError(err.message),
  });

  const handlePartialPaymentConfirm = useMutation({
    mutationFn: async (
      { itemIdsToPay, gorjetaValor, garcomId }: 
      { itemIdsToPay: { id: string; quantidade: number; isMesaItem: boolean }[], gorjetaValor: number, garcomId: string }
    ) => {
      if (!pedido || !clienteToPay) throw new Error("Pedido ou cliente não encontrado.");
      
      const { error: rpcError } = await supabase.rpc('finalizar_pagamento_parcial', {
        p_pedido_id: pedido.id,
        p_cliente_id: clienteToPay.id,
        p_item_ids_to_pay: itemIdsToPay,
        p_gorjeta_valor: gorjetaValor,
        p_garcom_id: garcomId,
      });
      if (rpcError) throw rpcError;
      
      // Envia confirmação de pagamento (se houver cliente principal)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', { 
          body: { pedidoId: pedido.id, userId: user.id } 
        });
        if (functionError) showError(`Pagamento parcial concluído, mas falha ao enviar notificação: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["historicoCliente"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["tipStats"] });
      showSuccess(`Pagamento parcial de ${clienteToPay?.nome} concluído!`);
      setIsPartialPaymentOpen(false);
      setClienteToPay(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleTotalPaymentConfirm = useMutation({
    mutationFn: async (
      { gorjetaValor, garcomId }: 
      { gorjetaValor: number, garcomId: string }
    ) => {
      if (!pedido || !mesa) throw new Error("Pedido ou mesa não encontrados.");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Atualiza o pedido aberto com a gorjeta e o garçom antes de fechar
      const { error: updateError } = await supabase.from("pedidos")
        .update({ gorjeta_valor: gorjetaValor, garcom_id: garcomId })
        .eq("id", pedido.id);
      if (updateError) throw updateError;

      // 2. Chama a função RPC para fechar o pedido e liberar a mesa
      const { error: rpcError } = await supabase.rpc('finalizar_pagamento_total', {
        p_pedido_id: pedido.id,
        p_mesa_id: mesa.id,
      });
      if (rpcError) throw rpcError;

      // 3. Envia confirmação de pagamento (se houver cliente principal)
      if (pedido.cliente_id) {
        const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', { 
          body: { pedidoId: pedido.id, userId: user.id } 
        });
        if (functionError) showError(`Conta fechada, mas falha ao enviar notificação: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["historicoCliente"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["tipStats"] });
      showSuccess("Conta total fechada com sucesso!");
      setIsTotalPaymentOpen(false);
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  if (!mesa) return null;

  const clientePrincipal = mesa.cliente_id ? ocupantesMap.get(mesa.cliente_id) : null;
  const itensRestantes = pedido?.itens_pedido || [];
  const hasPendingItems = itensRestantes.some(item => item.status === 'pendente' || item.status === 'preparando');
  const isTotalPaymentDisabled = hasPendingItems || itensRestantes.length === 0;

  const renderItemRow = (item: ItemPedido) => {
    const precoFinal = calcularPrecoComDesconto(item);
    const isRodizio = item.nome_produto.toUpperCase().includes('[RODIZIO]');
    const isResgate = item.nome_produto.toUpperCase().includes('[RESGATE]');
    
    const canEdit = !isRodizio && !isResgate;

    return (
      <TableRow key={item.id} className={cn(
        item.status === 'entregue' && 'bg-green-500/10',
        item.status === 'preparando' && 'bg-primary/10',
        item.status === 'cancelado' && 'bg-destructive/10 line-through text-muted-foreground'
      )}>
        <TableCell className="font-medium">
          {item.nome_produto}
          {item.desconto_percentual && item.desconto_percentual > 0 && (
            <span className="text-xs text-destructive ml-2">({item.desconto_percentual}% OFF)</span>
          )}
        </TableCell>
        <TableCell className="text-center w-[100px]">
          {canEdit && item.status !== 'cancelado' ? (
            <div className="flex items-center justify-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateItemQuantityMutation.mutate({ itemId: item.id, newQuantity: Math.max(1, item.quantidade - 1) })} disabled={item.quantidade <= 1 || updateItemQuantityMutation.isPending}><Minus className="w-3 h-3" /></Button>
              <span className="font-bold">{item.quantidade}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateItemQuantityMutation.mutate({ itemId: item.id, newQuantity: item.quantidade + 1 })} disabled={updateItemQuantityMutation.isPending}><PlusCircle className="w-3 h-3" /></Button>
            </div>
          ) : (
            <span className="font-bold">{item.quantidade}</span>
          )}
        </TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(precoFinal)}</TableCell>
        <TableCell className="text-center">
          {item.status === 'pendente' && <Badge variant="warning">Pendente</Badge>}
          {item.status === 'preparando' && <Badge variant="default" className="bg-primary text-primary-foreground">Preparo</Badge>}
          {item.status === 'entregue' && <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-primary-foreground">Entregue</Badge>}
          {item.status === 'cancelado' && <Badge variant="destructive">Cancelado</Badge>}
        </TableCell>
        <TableCell className="text-right w-[120px]">
          <div className="flex gap-1 justify-end">
            {canEdit && item.status !== 'cancelado' && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDiscountRequest(item)} disabled={isRequesting}><Tag className="w-4 h-4 text-blue-500" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteItemMutation.mutate(item.id)} disabled={deleteItemMutation.isPending}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  if (isLoading || isLoadingSuperadminId) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!pedido) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mesa {mesa.numero}</DialogTitle></DialogHeader>
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum pedido aberto para esta mesa.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-2xl">Pedido da Mesa {mesa.numero}</DialogTitle>
            <DialogDescription>
              Cliente Principal: <span className="font-semibold">{clientePrincipal?.nome || "Não identificado"}</span>
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="comanda" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 shrink-0">
              <TabsTrigger value="comanda">Comanda ({itensRestantes.length})</TabsTrigger>
              <TabsTrigger value="clientes">Clientes ({ocupantes.length})</TabsTrigger>
              <TabsTrigger value="resgate">Resgate de Pontos</TabsTrigger>
            </TabsList>

            <TabsContent value="comanda" className="flex-1 min-h-0 flex flex-col pt-4">
              <ScrollArea className="flex-1 pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qtd.</TableHead>
                      <TableHead className="text-right">Preço Final</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensRestantes.length > 0 ? (
                      itensRestantes.map(renderItemRow)
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum item restante no pedido.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              <div className="shrink-0 mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-lg">
                  <span>Subtotal:</span>
                  <span className="font-bold">{formatCurrency(subtotalItens)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span>Gorjeta (Total):</span>
                  <span className="font-bold text-green-600">{formatCurrency(totalGorjeta)}</span>
                </div>
                <div className="flex justify-between items-center text-2xl font-extrabold pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(totalFinal)}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="clientes" className="flex-1 min-h-0 pt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {Array.from(itensPorConsumidor.keys()).map(consumidorId => {
                    const isMesaGeral = consumidorId === 'mesa_geral';
                    const cliente = ocupantesMap.get(consumidorId);
                    const itens = itensPorConsumidor.get(consumidorId) || [];
                    const subtotalCliente = itens.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
                    const isPrincipal = cliente?.id === mesa.cliente_id;
                    
                    // Se for Mesa Geral, não permite pagamento parcial
                    const canPayPartially = !isMesaGeral && itens.length > 0;

                    return (
                      <div key={consumidorId} className={cn("p-4 border rounded-lg", isPrincipal ? "bg-primary/10 border-primary" : "bg-secondary/50")}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={cliente?.avatar_url || undefined} />
                              <AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-bold text-lg">{isMesaGeral ? "Mesa (Geral)" : cliente?.nome}</h4>
                              {isPrincipal && <Badge className="bg-primary text-primary-foreground">Principal</Badge>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-extrabold text-foreground">{formatCurrency(subtotalCliente)}</p>
                            <p className="text-xs text-muted-foreground">Subtotal</p>
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t">
                          <h5 className="font-semibold text-sm mb-2">Itens Consumidos:</h5>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {itens.map(item => (
                              <li key={item.id} className="flex justify-between">
                                <span>{item.nome_produto} (x{item.quantidade})</span>
                                <span>{formatCurrency(calcularPrecoComDesconto(item))}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {canPayPartially && (
                          <Button 
                            size="sm" 
                            className="w-full mt-4" 
                            onClick={() => handlePartialPaymentOpen(cliente!)}
                            disabled={handlePartialPaymentConfirm.isPending}
                          >
                            <DollarSign className="w-4 h-4 mr-2" /> Pagar Conta Parcial
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="resgate" className="flex-1 min-h-0 pt-4">
                <ResgatePontosDialog
                    isOpen={isResgateOpen}
                    onOpenChange={setIsResgateOpen}
                    ocupantes={ocupantes}
                    mesaId={mesa.id}
                    produtosResgatáveis={produtosResgatáveis}
                />
                <Button onClick={() => setIsResgateOpen(true)} className="w-full">
                    <Star className="w-4 h-4 mr-2" /> Abrir Resgate de Pontos
                </Button>
            </TabsContent>
          </Tabs>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button 
              variant="destructive" 
              onClick={handleTotalPaymentOpen} 
              disabled={isTotalPaymentDisabled || handleTotalPaymentConfirm.isPending}
            >
              <DollarSign className="w-4 h-4 mr-2" /> 
              {handleTotalPaymentConfirm.isPending ? "Fechando..." : `Finalizar Conta Total (${formatCurrency(totalFinal)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals de Ação */}
      <AplicarDescontoDialog
        isOpen={isDiscountOpen}
        onOpenChange={setIsDiscountOpen}
        item={itemToDiscount}
        onDiscountRequested={refetch}
      />
      
      {clienteToPay && (
        <FinalizarContaParcialDialog
          isOpen={isPartialPaymentOpen}
          onOpenChange={setIsPartialPaymentOpen}
          cliente={clienteToPay}
          itensIndividuais={itensPorConsumidor.get(clienteToPay.id) || []}
          staffProfiles={staffProfiles}
          onConfirm={(items, gorjeta, garcomId) => handlePartialPaymentConfirm.mutate({ itemIdsToPay: items, gorjetaValor: gorjeta, garcomId })}
          isSubmitting={handlePartialPaymentConfirm.isPending}
        />
      )}
      
      <FinalizarContaTotalDialog
        isOpen={isTotalPaymentOpen}
        onOpenChange={setIsTotalPaymentOpen}
        itensRestantes={itensRestantes}
        staffProfiles={staffProfiles}
        onConfirm={(gorjeta, garcomId) => handleTotalPaymentConfirm.mutate({ gorjetaValor: gorjeta, garcomId })}
        isSubmitting={handleTotalPaymentConfirm.isPending}
      />
    </>
  );
}