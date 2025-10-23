import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Pedido, ItemPedido, Produto, Cliente } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showError, showSuccess } from "@/utils/toast";
import { PlusCircle, Trash2, CreditCard, ChevronsUpDown, Check, Users, UserCheck, Tag, MoreHorizontal, AlertTriangle, Star, DollarSign } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FinalizarContaParcialDialog } from "./FinalizarContaParcialDialog";
import { AplicarDescontoDialog } from "./AplicarDescontoDialog";
import { ResgatePontosDialog } from "./ResgatePontosDialog";
import { Badge } from "../ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type PedidoModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesa: Mesa | null;
};

const itemSchema = z.object({
  nome_produto: z.string().min(2, "O nome do produto é obrigatório."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  preco: z.coerce.number(),
  consumido_por_cliente_id: z.string().uuid().nullable().optional(),
  status: z.enum(['pendente', 'preparando', 'entregue']),
  requer_preparo: z.boolean(),
});

async function fetchPedidoAberto(mesaId: string): Promise<(Pedido & { itens_pedido: ItemPedido[] }) | null> {
  if (!mesaId) return null;
  // Ajustado para pegar o pedido mais recente se houver múltiplos abertos (inconsistência)
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .order("created_at", { ascending: false }) // Ordena para pegar o mais recente
    .limit(1) // Limita a 1 resultado
    .maybeSingle(); // Usa maybeSingle agora que limitamos a 1

  if (error) throw new Error(error.message);
  return data;
}

async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchOcupantes(mesaId: string): Promise<Cliente[]> {
  const { data: ocupanteIds, error: idsError } = await supabase.from("mesa_ocupantes").select("cliente_id").eq("mesa_id", mesaId);
  if (idsError) throw idsError;

  const ids = ocupanteIds.map(o => o.cliente_id);
  if (ids.length === 0) return [];
  
  // Adicionado 'pontos' na seleção de clientes
  const { data: clientes, error: clientesError } = await supabase.from("clientes").select("id, nome, pontos").in("id", ids);
  if (clientesError) throw clientesError;
  return clientes;
}

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

type ItemToPayWithQuantity = {
  id: string;
  quantidade: number;
  isMesaItem: boolean;
};

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [clientePagandoIndividual, setClientePagandoIndividual] = useState<Cliente | null>(null);
  const [itemParaDesconto, setItemParaDesconto] = useState<ItemPedido | null>(null);
  const [isResgateOpen, setIsResgateOpen] = useState(false);
  
  // Novo estado para pagamento parcial de item da mesa
  const [itemMesaToPay, setItemMesaToPay] = useState<ItemPedido | null>(null);
  const [quantidadePagarMesa, setQuantidadePagarMesa] = useState(1);
  const [clientePagandoMesaId, setClientePagandoMesaId] = useState<string | null>(null);
  const [isMesaItemPartialPaymentOpen, setIsMesaItemPartialPaymentOpen] = useState(false);


  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { nome_produto: "", quantidade: 1, preco: 0, consumido_por_cliente_id: null, status: 'pendente', requer_preparo: true },
  });

  const { data: pedido, isLoading, isError: isPedidoError, error: pedidoError } = useQuery({
    queryKey: ["pedidoAberto", mesa?.id],
    queryFn: () => fetchPedidoAberto(mesa!.id),
    enabled: !!mesa && isOpen,
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: fetchProdutos,
    enabled: isOpen,
  });

  const { data: ocupantes } = useQuery({
    queryKey: ["ocupantes", mesa?.id],
    queryFn: () => fetchOcupantes(mesa!.id),
    enabled: !!mesa && isOpen,
  });

  const clientePrincipal = ocupantes?.find(o => o.id === mesa?.cliente_id) || null;
  const produtosResgatáveis = produtos?.filter(p => p.pontos_resgate && p.pontos_resgate > 0) || [];

  const { itensAgrupados, totalPedido, itensMesaGeral } = useMemo(() => {
    if (!pedido?.itens_pedido || !ocupantes) return { itensAgrupados: new Map(), totalPedido: 0, itensMesaGeral: [] };
    
    const total = pedido.itens_pedido.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
    
    const agrupados = new Map<string, { cliente: Cliente | { id: 'mesa', nome: 'Mesa' }; itens: ItemPedido[]; subtotal: number }>();
    
    ocupantes.forEach(o => agrupados.set(o.id, { cliente: o, itens: [], subtotal: 0 }));
    agrupados.set('mesa', { cliente: { id: 'mesa', nome: 'Mesa (Geral)' }, itens: [], subtotal: 0 });

    const mesaGeral: ItemPedido[] = [];

    pedido.itens_pedido.forEach(item => {
      const key = item.consumido_por_cliente_id || 'mesa';
      const grupo = agrupados.get(key);
      if (grupo) {
        grupo.itens.push(item);
        grupo.subtotal += calcularPrecoComDesconto(item);
        if (key === 'mesa') {
          mesaGeral.push(item);
        }
      }
    });

    return { itensAgrupados: agrupados, totalPedido: total, itensMesaGeral: mesaGeral };
  }, [pedido, ocupantes]);

  // Função para obter os itens a serem pagos pelo cliente (apenas os individuais)
  const getItemsToPayIndividual = (clienteId: string) => {
    return itensAgrupados.get(clienteId)?.itens || [];
  };
  
  const addItemMutation = useMutation({
    mutationFn: async (novoItem: z.infer<typeof itemSchema>) => {
      if (!mesa || !mesa.cliente_id) throw new Error("Mesa ou cliente não selecionado.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado.");

      let pedidoId = pedido?.id;
      if (!pedidoId) {
        const { data: novoPedido, error: pedidoError } = await supabase.from("pedidos").insert({ mesa_id: mesa.id, cliente_id: mesa.cliente_id, user_id: user.id, status: "aberto" }).select("id").single();
        if (pedidoError) throw new Error(pedidoError.message);
        pedidoId = novoPedido.id;
      }

      const produtoSelecionado = produtos?.find(p => p.nome === novoItem.nome_produto);
      if (!produtoSelecionado) throw new Error("Produto não encontrado.");

      let nomeProdutoFinal = novoItem.nome_produto;
      let requerPreparo = produtoSelecionado.requer_preparo;
      let status: ItemPedido['status'] = 'pendente';

      // 1. Adicionar prefixo se for Pacote Rodízio
      if (produtoSelecionado.tipo === 'rodizio') {
          nomeProdutoFinal = `[RODIZIO] ${novoItem.nome_produto}`;
          requerPreparo = false; // Pacote Rodízio nunca requer preparo
      }
      
      // 2. Se for Item de Rodízio, usa o requer_preparo definido pelo usuário
      if (produtoSelecionado.tipo === 'componente_rodizio') {
          requerPreparo = produtoSelecionado.requer_preparo; 
      }
      
      // 3. Determinar o status inicial
      status = 'pendente'; 

      const { error: itemError } = await supabase.from("itens_pedido").insert({ 
        pedido_id: pedidoId, 
        user_id: user.id, 
        ...novoItem,
        nome_produto: nomeProdutoFinal,
        status: status,
        requer_preparo: requerPreparo,
      });
      if (itemError) throw new Error(itemError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] }); // Adicionado invalidação para o sininho
      showSuccess("Item adicionado com sucesso!");
      form.reset({ nome_produto: "", quantidade: 1, preco: 0, consumido_por_cliente_id: null, status: 'pendente', requer_preparo: true });
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("itens_pedido").delete().eq("id", itemId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] }); // Adicionado invalidação para o sininho
      showSuccess("Item removido com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const closePartialOrderMutation = useMutation({
    mutationFn: async ({ clienteId, itemsToPayWithQuantity }: { clienteId: string, itemsToPayWithQuantity: ItemToPayWithQuantity[] }) => {
      if (!pedido) throw new Error("Pedido não encontrado.");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Criar um novo pedido "recibo"
      const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
        user_id: user.id, 
        cliente_id: clienteId, 
        status: 'pago', 
        closed_at: new Date().toISOString(), 
        mesa_id: mesa!.id, 
        acompanhantes: pedido.acompanhantes,
      }).select("id").single();
      if (newPedidoError) throw newPedidoError;
      const newPedidoId = newPedido.id;

      const itemIdsToUpdate = itemsToPayWithQuantity.map(i => i.id);
      const itemsToUpdate = pedido.itens_pedido.filter(item => itemIdsToUpdate.includes(item.id));

      for (const itemToPay of itemsToPayWithQuantity) {
        const originalItem = itemsToUpdate.find(i => i.id === itemToPay.id);
        if (!originalItem) continue;

        const quantityToPay = itemToPay.quantidade;
        const quantityRemaining = originalItem.quantidade - quantityToPay;

        if (itemToPay.isMesaItem && quantityRemaining > 0) {
          // Se for item da mesa e houver quantidade restante, criamos um novo item para o recibo
          // e atualizamos a quantidade do item original.
          
          // 1a. Criar o item pago (para o recibo)
          const { error: insertError } = await supabase.from("itens_pedido").insert({
            ...originalItem,
            id: undefined, // Deixa o banco gerar um novo ID
            pedido_id: newPedidoId,
            quantidade: quantityToPay,
            consumido_por_cliente_id: clienteId,
            created_at: new Date().toISOString(), // Atualiza o timestamp
            updated_at: new Date().toISOString(),
          });
          if (insertError) throw insertError;

          // 1b. Atualizar a quantidade restante no item original (no pedido aberto)
          const { error: updateError } = await supabase.from("itens_pedido")
            .update({ quantidade: quantityRemaining, updated_at: new Date().toISOString() })
            .eq("id", originalItem.id);
          if (updateError) throw updateError;

        } else {
          // Se for item individual ou item da mesa pago integralmente, move o item inteiro
          const { error: updateError } = await supabase.from("itens_pedido")
            .update({ 
                pedido_id: newPedidoId, 
                consumido_por_cliente_id: clienteId,
                updated_at: new Date().toISOString(),
            })
            .eq("id", originalItem.id);
          if (updateError) throw updateError;
        }
      }

      // 2. Remover o cliente da lista de ocupantes da mesa
      await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesa!.id).eq("cliente_id", clienteId);

      // 3. Verificar se o pedido original ainda tem itens
      const { count: remainingItemsCount } = await supabase.from("itens_pedido")
        .select('*', { count: 'exact', head: true })
        .eq("pedido_id", pedido.id);
        
      // 4. Verificar se ainda há ocupantes na mesa
      const { count: remainingOccupantsCount } = await supabase.from("mesa_ocupantes")
        .select('*', { count: 'exact', head: true })
        .eq("mesa_id", mesa!.id);

      // 5. Se o pedido original estiver vazio, fechar o pedido original
      if (remainingItemsCount === 0) {
        await supabase.from('pedidos').update({ status: 'pago', closed_at: new Date().toISOString() }).eq('id', pedido.id);
      }
      
      // 6. Se não houver mais ocupantes, liberar a mesa (cliente_id = null)
      if (remainingOccupantsCount === 0) {
        await supabase.from('mesas').update({ cliente_id: null }).eq('id', mesa!.id);
      }
    },
    onSuccess: (_, { clienteId }) => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["ocupantes", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] }); // Invalida clientes para atualizar pontos
      const cliente = ocupantes?.find(o => o.id === clienteId);
      showSuccess(`Conta de ${cliente?.nome || 'cliente'} finalizada!`);
      setClientePagandoIndividual(null);
      setIsMesaItemPartialPaymentOpen(false); // Fecha o modal de pagamento parcial de item da mesa
    },
    onError: (error: Error) => showError(error.message),
  });

  const closeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!pedido || !mesa || !ocupantes) throw new Error("Pedido, mesa ou ocupantes não encontrados.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Chamar a nova função RPC para fechar o pedido e liberar a mesa
      // Esta função já atribui todos os itens restantes (Mesa Geral) ao cliente principal
      const { error: rpcError } = await supabase.rpc('finalizar_pagamento_total', {
        p_pedido_id: pedido.id,
        p_mesa_id: mesa.id,
      });
      if (rpcError) throw rpcError;

      // 2. Enviar webhook de confirmação de pagamento (usando o pedidoId)
      if (pedido.cliente_id) {
        const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', { 
          body: { pedidoId: pedido.id, userId: user.id } 
        });
        if (functionError) showError(`Conta fechada, mas falha ao enviar webhook: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["historicoCliente"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] }); // Adicionado invalidação para o sininho
      showSuccess("Conta fechada com sucesso!");
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleDiscountRequested = () => {
    // Invalida o pedido para buscar o item atualizado com o desconto
    queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
  };

  const onSubmit = (values: z.infer<typeof itemSchema>) => {
    const produtoSelecionado = produtos?.find(p => p.nome === values.nome_produto);
    
    if (!produtoSelecionado) {
        showError("Produto não encontrado.");
        return;
    }

    let nomeProdutoFinal = values.nome_produto;
    let requerPreparo = produtoSelecionado.requer_preparo;
    
    // 1. Adicionar prefixo se for Pacote Rodízio
    if (produtoSelecionado.tipo === 'rodizio') {
        nomeProdutoFinal = `[RODIZIO] ${values.nome_produto}`;
        requerPreparo = false; // Pacote Rodízio nunca requer preparo
    }
    
    // 2. Se for Item de Rodízio, usa o requer_preparo definido pelo usuário
    if (produtoSelecionado.tipo === 'componente_rodizio') {
        requerPreparo = produtoSelecionado.requer_preparo; 
    }
    
    // 3. Determinar o status inicial
    status = 'pendente';

    addItemMutation.mutate({ 
        ...values, 
        nome_produto: nomeProdutoFinal, // Usando o nome final
        status: status,
        requer_preparo: requerPreparo,
    });
  };
  
  // Função para abrir o modal de pagamento individual
  const handlePartialPaymentOpen = (cliente: Cliente) => {
    const items = getItemsToPayIndividual(cliente.id);
    if (items.length === 0) {
        showError(`O cliente ${cliente.nome} não possui itens individuais para pagar.`);
        return;
    }
    setClientePagandoIndividual(cliente);
  };
  
  // Função para abrir o modal de pagamento parcial de item da mesa
  const handleMesaItemPartialPaymentOpen = (item: ItemPedido) => {
    if (!ocupantes || ocupantes.length === 0) {
        showError("Não há clientes ocupando a mesa para atribuir o pagamento.");
        return;
    }
    setItemMesaToPay(item);
    setQuantidadePagarMesa(1);
    setClientePagandoMesaId(ocupantes[0].id); // Default para o primeiro ocupante
    setIsMesaItemPartialPaymentOpen(true);
  };
  
  // Mutação para pagamento parcial de item da mesa
  const payMesaItemPartialMutation = useMutation({
    mutationFn: async ({ itemId, quantidade, clienteId }: { itemId: string, quantidade: number, clienteId: string }) => {
      if (!pedido) throw new Error("Pedido não encontrado.");
      
      const originalItem = itensMesaGeral.find(i => i.id === itemId);
      if (!originalItem) throw new Error("Item da mesa não encontrado.");
      if (quantidade > originalItem.quantidade) throw new Error("Quantidade a pagar excede a quantidade restante.");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Criar um novo pedido "recibo" (usando o cliente que está pagando)
      const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
        user_id: user.id, 
        cliente_id: clienteId, 
        status: 'pago', 
        closed_at: new Date().toISOString(), 
        mesa_id: mesa!.id, 
        acompanhantes: pedido.acompanhantes,
      }).select("id").single();
      if (newPedidoError) throw newPedidoError;
      const newPedidoId = newPedido.id;

      const quantityRemaining = originalItem.quantidade - quantidade;

      // 2a. Criar o item pago (para o recibo)
      const { error: insertError } = await supabase.from("itens_pedido").insert({
        ...originalItem,
        id: undefined, // Deixa o banco gerar um novo ID
        pedido_id: newPedidoId,
        quantidade: quantidade,
        consumido_por_cliente_id: clienteId,
        created_at: new Date().toISOString(), // Atualiza o timestamp
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      // 2b. Atualizar a quantidade restante no item original (no pedido aberto)
      if (quantityRemaining > 0) {
        const { error: updateError } = await supabase.from("itens_pedido")
          .update({ quantidade: quantityRemaining, updated_at: new Date().toISOString() })
          .eq("id", originalItem.id);
        if (updateError) throw updateError;
      } else {
        // Se a quantidade restante for 0, deleta o item original do pedido aberto
        const { error: deleteError } = await supabase.from("itens_pedido")
          .delete()
          .eq("id", originalItem.id);
        if (deleteError) throw deleteError;
      }
      
      // 3. Verificar se o pedido original ficou vazio e fechar se necessário
      const { count: remainingItemsCount } = await supabase.from("itens_pedido")
        .select('*', { count: 'exact', head: true })
        .eq("pedido_id", pedido.id);
        
      if (remainingItemsCount === 0) {
        await supabase.from('pedidos').update({ status: 'pago', closed_at: new Date().toISOString() }).eq('id', pedido.id);
        // Se o pedido fechar, liberamos a mesa (cliente_id = null) e removemos ocupantes
        await supabase.from('mesas').update({ cliente_id: null }).eq('id', mesa!.id);
        await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesa!.id);
      }
    },
    onSuccess: (_, { clienteId }) => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["ocupantes", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      const cliente = ocupantes?.find(o => o.id === clienteId);
      showSuccess(`Pagamento parcial de item da mesa atribuído a ${cliente?.nome || 'cliente'}!`);
      setIsMesaItemPartialPaymentOpen(false);
    },
    onError: (error: Error) => showError(error.message),
  });
  
  const handleConfirmMesaItemPayment = () => {
    if (itemMesaToPay && clientePagandoMesaId && quantidadePagarMesa > 0) {
        payMesaItemPartialMutation.mutate({
            itemId: itemMesaToPay.id,
            quantidade: quantidadePagarMesa,
            clienteId: clientePagandoMesaId,
        });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Pedido da Mesa {mesa?.numero}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{ocupantes?.map(o => o.nome).join(', ') || "N/A"}</span>
              {clientePrincipal && (
                <Badge variant="secondary" className="ml-4 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                  {clientePrincipal.pontos} pontos (Principal)
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          {isPedidoError ? (
            <div className="flex flex-col items-center justify-center p-8 text-destructive">
              <AlertTriangle className="w-12 h-12 mb-4" />
              <p className="text-lg font-semibold">Erro ao carregar o pedido!</p>
              <p className="text-sm text-center">
                {pedidoError?.message || "Houve um problema ao buscar os detalhes do pedido. Por favor, tente novamente."}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Se o problema persistir, pode haver múltiplos pedidos abertos para esta mesa.
              </p>
            </div>
          ) : isLoading ? (
            <p>Carregando...</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh]">
              <div className="space-y-4 overflow-y-auto pr-2">
                <h3 className="font-semibold">Itens do Pedido</h3>
                {Array.from(itensAgrupados.values()).map(({ cliente, itens, subtotal }) => {
                  // Se for o grupo 'Mesa (Geral)', exibimos separadamente para que qualquer um possa pagar
                  if (cliente.id === 'mesa' && itens.length > 0) {
                    return (
                      <div key={cliente.id} className="p-3 border rounded-lg bg-warning/10">
                        <h4 className="font-semibold text-warning-foreground">Mesa (Geral) - Itens Pendentes</h4>
                        <ul className="space-y-2 mt-2">
                          {itens.map((item) => {
                            const precoOriginal = (item.preco || 0) * item.quantidade;
                            const precoFinal = calcularPrecoComDesconto(item);
                            return (
                              <li key={item.id} className="flex justify-between items-center p-2 bg-secondary/50 rounded text-sm">
                                <div>
                                  <p className="font-medium">{item.nome_produto} (x{item.quantidade})</p>
                                  {item.desconto_percentual && item.desconto_percentual > 0 && (
                                    <Badge variant="secondary" className="mt-1">{item.desconto_percentual}% off - {item.desconto_motivo}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="text-right">
                                    {item.desconto_percentual && item.desconto_percentual > 0 ? (
                                      <>
                                        <p className="text-muted-foreground line-through text-xs">R$ {precoOriginal.toFixed(2)}</p>
                                        <p className="font-semibold">R$ {precoFinal.toFixed(2)}</p>
                                      </>
                                    ) : (
                                      <p>R$ {precoOriginal.toFixed(2)}</p>
                                    )}
                                  </div>
                                  {/* Botão de Pagamento Parcial para Item da Mesa */}
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleMesaItemPartialPaymentOpen(item)}
                                  >
                                    <DollarSign className="w-4 h-4" />
                                  </Button>
                                  {/* Dropdown de Ações */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => setItemParaDesconto(item)}>
                                        <Tag className="h-4 w-4 mr-2" />
                                        <span>Aplicar Desconto</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        <span>Remover Item</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="text-right font-semibold mt-2">Subtotal: R$ {subtotal.toFixed(2)}</p>
                      </div>
                    );
                  }
                  
                  // Exibição normal para clientes individuais
                  if (cliente.id !== 'mesa' && itens.length > 0) {
                    const isPrincipal = cliente.id === clientePrincipal?.id;
                    const subtotalIndividual = itens.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);

                    return (
                      <div key={cliente.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold">{cliente.nome} {isPrincipal && "(Principal)"}</h4>
                          <Button size="sm" variant="outline" onClick={() => handlePartialPaymentOpen(cliente as Cliente)}>
                            <UserCheck className="w-4 h-4 mr-2" /> Finalizar Conta
                          </Button>
                        </div>
                        <ul className="space-y-2">
                          {itens.map((item) => {
                            const precoOriginal = (item.preco || 0) * item.quantidade;
                            const precoFinal = calcularPrecoComDesconto(item);
                            
                            return (
                              <li key={item.id} className="flex justify-between items-center p-2 bg-secondary/50 rounded text-sm">
                                <div>
                                  <p className="font-medium">{item.nome_produto} (x{item.quantidade})</p>
                                  {item.desconto_percentual && item.desconto_percentual > 0 && (
                                    <Badge variant="secondary" className="mt-1">{item.desconto_percentual}% off - {item.desconto_motivo}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="text-right">
                                    {item.desconto_percentual && item.desconto_percentual > 0 ? (
                                      <>
                                        <p className="text-muted-foreground line-through text-xs">R$ {precoOriginal.toFixed(2)}</p>
                                        <p className="font-semibold">R$ {precoFinal.toFixed(2)}</p>
                                      </>
                                    ) : (
                                      <p>R$ {precoOriginal.toFixed(2)}</p>
                                    )}
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => setItemParaDesconto(item)}>
                                        <Tag className="h-4 w-4 mr-2" />
                                        <span>Aplicar Desconto</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        <span>Remover Item</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="text-right font-semibold mt-2">Subtotal: R$ {subtotalIndividual.toFixed(2)}</p>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-4">Adicionar Novo Item</h3>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="nome_produto" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Produto</FormLabel>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                {field.value ? produtos?.find(p => p.nome === field.value)?.nome : "Selecione um produto"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Buscar produto..." /><CommandList><CommandEmpty>Nenhum produto encontrado.</CommandEmpty><CommandGroup>
                            {produtos?.map((produto) => (<CommandItem value={produto.nome} key={produto.id} onSelect={() => {
                              const preco = produto.tipo === 'componente_rodizio' ? 0 : produto.preco;
                              form.setValue("nome_produto", produto.nome);
                              form.setValue("preco", preco);
                              form.setValue("requer_preparo", produto.requer_preparo); // Define requer_preparo
                              setPopoverOpen(false);
                            }}>
                              <Check className={cn("mr-2 h-4 w-4", produto.nome === field.value ? "opacity-100" : "opacity-0")} />{produto.nome}</CommandItem>))}
                          </CommandGroup></CommandList></Command></PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}/>
                    <FormField control={form.control} name="quantidade" render={({ field }) => (<FormItem><FormLabel>Quantidade</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="consumido_por_cliente_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consumido por</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === 'null' ? null : value)} value={field.value ?? 'null'}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione quem consumiu" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="null">Mesa (Geral)</SelectItem>
                            {ocupantes?.map(ocupante => (<SelectItem key={ocupante.id} value={ocupante.id}>{ocupante.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}/>
                    <Button type="submit" className="w-full" disabled={addItemMutation.isPending}><PlusCircle className="w-4 h-4 mr-2" />Adicionar ao Pedido</Button>
                    
                    {/* NOVO BOTÃO DE RESGATE - Agora só verifica se há ocupantes e produtos resgatáveis */}
                    {ocupantes && ocupantes.length > 0 && produtosResgatáveis.length > 0 && (
                      <Button type="button" variant="secondary" className="w-full mt-2" onClick={() => setIsResgateOpen(true)}>
                        <Star className="w-4 h-4 mr-2 fill-yellow-500 text-yellow-500" />
                        Resgatar Prêmios
                      </Button>
                    )}
                  </form>
                </Form>
              </div>
            </div>
          )}
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total Restante na Mesa:</span>
              <span>R$ {totalPedido.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => closeOrderMutation.mutate()} disabled={!pedido || totalPedido === 0 || closeOrderMutation.isPending}>
              <CreditCard className="w-4 h-4 mr-2" />
              {closeOrderMutation.isPending ? "Finalizando..." : "Finalizar Conta Total"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Pagamento de Itens Individuais */}
      <FinalizarContaParcialDialog
        isOpen={!!clientePagandoIndividual}
        onOpenChange={() => setClientePagandoIndividual(null)}
        cliente={clientePagandoIndividual}
        itensIndividuais={getItemsToPayIndividual(clientePagandoIndividual?.id || '')}
        clientePrincipalId={clientePrincipal?.id || null}
        onConfirm={(itemsToPayWithQuantity) => clientePagandoIndividual && closePartialOrderMutation.mutate({ clienteId: clientePagandoIndividual.id, itemsToPayWithQuantity })}
        isSubmitting={closePartialOrderMutation.isPending}
      />
      
      {/* Modal de Pagamento Parcial de Item da Mesa */}
      <AlertDialog open={isMesaItemPartialPaymentOpen} onOpenChange={setIsMesaItemPartialPaymentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pagar Item da Mesa</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione a quantidade e o cliente que está pagando o item: <span className="font-semibold">{itemMesaToPay?.nome_produto}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {itemMesaToPay && ocupantes && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cliente-pagando-mesa">Cliente Pagando</Label>
                <Select 
                  value={clientePagandoMesaId || ''} 
                  onValueChange={setClientePagandoMesaId}
                  disabled={ocupantes.length === 0 || payMesaItemPartialMutation.isPending}
                >
                  <SelectTrigger id="cliente-pagando-mesa" className="mt-1">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {ocupantes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="quantidade-pagar">Quantidade a Pagar (Máx: {itemMesaToPay.quantidade})</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setQuantidadePagarMesa(prev => Math.max(1, prev - 1))} 
                    disabled={quantidadePagarMesa <= 1 || payMesaItemPartialMutation.isPending}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input 
                    type="number" 
                    min="1" 
                    max={itemMesaToPay.quantidade}
                    value={quantidadePagarMesa} 
                    onChange={(e) => setQuantidadePagarMesa(Math.max(1, Math.min(itemMesaToPay.quantidade, parseInt(e.target.value) || 1)))} 
                    className="w-16 text-center"
                    disabled={payMesaItemPartialMutation.isPending}
                  />
                  <Button 
                    size="icon" 
                    onClick={() => setQuantidadePagarMesa(prev => Math.min(itemMesaToPay.quantidade, prev + 1))} 
                    disabled={quantidadePagarMesa >= itemMesaToPay.quantidade || payMesaItemPartialMutation.isPending}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                <span>Total a Pagar:</span>
                <span>{formatCurrency(calcularPrecoComDesconto({ ...itemMesaToPay, quantidade: 1 }) * quantidadePagarMesa)}</span>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={payMesaItemPartialMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmMesaItemPayment} 
              disabled={!clientePagandoMesaId || quantidadePagarMesa <= 0 || payMesaItemPartialMutation.isPending}
            >
              {payMesaItemPartialMutation.isPending ? "Processando..." : "Confirmar Pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AplicarDescontoDialog
        isOpen={!!itemParaDesconto}
        onOpenChange={() => setItemParaDesconto(null)}
        item={itemParaDesconto}
        onDiscountRequested={handleDiscountRequested}
      />
      {/* NOVO MODAL DE RESGATE */}
      <ResgatePontosDialog
        isOpen={isResgateOpen}
        onOpenChange={setIsResgateOpen}
        ocupantes={ocupantes || []}
        mesaId={mesa?.id || null}
        produtosResgatáveis={produtosResgatáveis}
      />
    </>
  );
}