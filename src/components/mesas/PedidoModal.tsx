import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Pedido, ItemPedido, Produto, Cliente, StaffProfile, UserRole } from "@/types/supabase";
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
import { PlusCircle, Trash2, CreditCard, ChevronsUpDown, Check, Users, UserCheck, Tag, MoreHorizontal, AlertTriangle, Star, DollarSign, Minus, Plus, User as UserIcon } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { FinalizarContaParcialDialog } from "./FinalizarContaParcialDialog";
import { AplicarDescontoDialog } from "./AplicarDescontoDialog";
import { ResgatePontosDialog } from "./ResgatePontosDialog";
import { Badge } from "../ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

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

type GroupedItem = ItemPedido & {
  original_ids: string[];
  total_quantidade: number;
  subtotal: number;
};

type GroupedClientItems = {
  cliente: Cliente | { id: 'mesa', nome: string };
  itens: GroupedItem[];
  subtotal: number;
};

const WAITER_ROLES: UserRole[] = ['garcom', 'balcao', 'gerente', 'admin', 'superadmin'];

async function fetchPedidoAberto(mesaId: string): Promise<(Pedido & { itens_pedido: ItemPedido[] }) | null> {
  if (!mesaId) return null;
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("mesa_id", mesaId)
    .eq("status", "aberto")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
  
  const { data: clientes, error: clientesError } = await supabase.from("clientes").select("id, nome, pontos").in("id", ids);
  if (clientesError) throw clientesError;
  return clientes;
}

async function fetchWaiters(): Promise<StaffProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("role", WAITER_ROLES);
  if (error) throw error;
  return data as StaffProfile[] || [];
}

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  const queryClient = useQueryClient();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [clientePagandoIndividual, setClientePagandoIndividual] = useState<Cliente | null>(null);
  const [itemParaDesconto, setItemParaDesconto] = useState<ItemPedido | null>(null);
  const [isResgateOpen, setIsResgateOpen] = useState(false);
  
  const [itemMesaToPay, setItemMesaToPay] = useState<GroupedItem | null>(null);
  const [quantidadePagarMesa, setQuantidadePagarMesa] = useState(1);
  const [clientePagandoMesaId, setClientePagandoMesaId] = useState<string | null>(null);
  const [isMesaItemPartialPaymentOpen, setIsMesaItemPartialPaymentOpen] = useState(false);
  
  // Gorjeta State
  const [tipEnabled, setTipEnabled] = useState(false);
  const [selectedGarcomId, setSelectedGarcomId] = useState<string | null>(null);

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
  
  const { data: waiters } = useQuery({
    queryKey: ["waiters"],
    queryFn: fetchWaiters,
    enabled: isOpen,
  });

  const clientePrincipal = ocupantes?.find(o => o.id === mesa?.cliente_id) || null;
  const produtosResgatáveis = produtos?.filter(p => p.pontos_resgate && p.pontos_resgate > 0) || [];
  
  const hasActiveOccupants = ocupantes && ocupantes.length > 0;

  const form = useForm<z.infer<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { 
      nome_produto: "", 
      quantidade: 1, 
      preco: 0, 
      consumido_por_cliente_id: null,
      status: 'pendente', 
      requer_preparo: true 
    },
  });
  
  useEffect(() => {
    if (isOpen && clientePrincipal) {
      form.setValue('consumido_por_cliente_id', clientePrincipal.id);
    } else if (isOpen && !clientePrincipal) {
      form.setValue('consumido_por_cliente_id', null);
    }
  }, [isOpen, clientePrincipal, form]);

  const { itensAgrupados, subtotalItens, itensMesaGeral } = useMemo(() => {
    if (!pedido?.itens_pedido || !ocupantes) return { itensAgrupados: new Map(), subtotalItens: 0, itensMesaGeral: [] };
    
    const subtotal = pedido.itens_pedido.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
    
    const agrupados = new Map<string, GroupedClientItems>();
    
    ocupantes.forEach(o => agrupados.set(o.id, { cliente: o, itens: [], subtotal: 0 }));
    agrupados.set('mesa', { cliente: { id: 'mesa', nome: 'Mesa (Geral)' }, itens: [], subtotal: 0 });

    const mesaGeral: GroupedItem[] = [];

    const groupedItemsMap = new Map<string, Map<string, ItemPedido[]>>();

    pedido.itens_pedido.forEach(item => {
      const consumerKey = item.consumido_por_cliente_id || 'mesa';
      const productKey = item.nome_produto;
      
      if (!groupedItemsMap.has(consumerKey)) {
        groupedItemsMap.set(consumerKey, new Map());
      }
      const productMap = groupedItemsMap.get(consumerKey)!;
      
      if (!productMap.has(productKey)) {
        productMap.set(productKey, []);
      }
      productMap.get(productKey)!.push(item);
    });

    groupedItemsMap.forEach((productMap, consumerKey) => {
      const clientGroup = agrupados.get(consumerKey);
      if (!clientGroup) return;

      productMap.forEach((items, nome_produto) => {
        const total_quantidade = items.reduce((sum, item) => sum + item.quantidade, 0);
        const subtotalItem = items.reduce((sum, item) => sum + calcularPrecoComDesconto(item), 0);
        
        const baseItem = items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        
        const groupedItem: GroupedItem = {
          ...baseItem,
          nome_produto,
          quantidade: total_quantidade,
          subtotal: subtotalItem,
          original_ids: items.map(i => i.id),
          total_quantidade,
        };
        
        clientGroup.itens.push(groupedItem);
        clientGroup.subtotal += subtotalItem;
        
        if (consumerKey === 'mesa') {
          mesaGeral.push(groupedItem);
        }
      });
    });

    return { itensAgrupados: agrupados, subtotalItens: subtotal, itensMesaGeral: mesaGeral };
  }, [pedido, ocupantes]);
  
  const gorjetaValor = tipEnabled ? subtotalItens * 0.1 : 0;
  const totalPedido = subtotalItens + gorjetaValor;

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
      
      if (produtoSelecionado.tipo === 'rodizio') {
          nomeProdutoFinal = `[RODIZIO] ${novoItem.nome_produto}`;
          requerPreparo = false;
      }
      
      if (produtoSelecionado.tipo === 'componente_rodizio') {
          requerPreparo = produtoSelecionado.requer_preparo; 
      }
      
      let status: ItemPedido['status'] = 'pendente';

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
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess("Item adicionado com sucesso!");
      
      form.reset({ 
        nome_produto: "", 
        quantidade: 1, 
        preco: 0, 
        consumido_por_cliente_id: clientePrincipal?.id || null, 
        status: 'pendente', 
        requer_preparo: true 
      });
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (item: GroupedItem) => {
      const { error } = await supabase.from("itens_pedido").delete().in("id", item.original_ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      showSuccess("Item removido com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const closePartialOrderMutation = useMutation({
    mutationFn: async ({ clienteId, allOriginalItemIds }: { clienteId: string, allOriginalItemIds: string[] }) => {
      if (!pedido) throw new Error("Pedido não encontrado.");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const itemsToPay = pedido.itens_pedido.filter(item => allOriginalItemIds.includes(item.id));
      const subtotalParcial = itemsToPay.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
      const gorjetaParcial = tipEnabled ? subtotalParcial * 0.1 : 0;
      
      const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
        user_id: user.id, 
        cliente_id: clienteId, 
        status: 'pago', 
        closed_at: new Date().toISOString(), 
        mesa_id: mesa!.id, 
        acompanhantes: pedido.acompanhantes,
        gorjeta_valor: gorjetaParcial,
        garcom_id: selectedGarcomId,
      }).select("id").single();
      if (newPedidoError) throw newPedidoError;
      const newPedidoId = newPedido.id;

      const { error: moveError } = await supabase.from("itens_pedido")
          .update({ 
              pedido_id: newPedidoId, 
              consumido_por_cliente_id: clienteId,
              updated_at: new Date().toISOString(),
          })
          .in("id", allOriginalItemIds);
      if (moveError) throw moveError;

      await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesa!.id).eq("cliente_id", clienteId);

      const { count: remainingItemsCount } = await supabase.from("itens_pedido")
        .select('*', { count: 'exact', head: true })
        .eq("pedido_id", pedido.id);
        
      const { count: remainingOccupantsCount } = await supabase.from("mesa_ocupantes")
        .select('*', { count: 'exact', head: true })
        .eq("mesa_id", mesa!.id);

      if (remainingItemsCount === 0) {
        await supabase.from('pedidos').update({ status: 'pago', closed_at: new Date().toISOString() }).eq('id', pedido.id);
      }
      
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
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["tipStats"] });
      const cliente = ocupantes?.find(o => o.id === clienteId);
      showSuccess(`Conta de ${cliente?.nome || 'cliente'} finalizada!`);
      setClientePagandoIndividual(null);
      setIsMesaItemPartialPaymentOpen(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const closeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!pedido || !mesa || !ocupantes) throw new Error("Pedido, mesa ou ocupantes não encontrados.");
      if (tipEnabled && !selectedGarcomId) throw new Error("Selecione o garçom para aplicar a gorjeta.");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { error: updateError } = await supabase.from("pedidos")
        .update({ gorjeta_valor: gorjetaValor, garcom_id: selectedGarcomId })
        .eq("id", pedido.id);
      if (updateError) throw updateError;

      const { error: rpcError } = await supabase.rpc('finalizar_pagamento_total', {
        p_pedido_id: pedido.id,
        p_mesa_id: mesa.id,
      });
      if (rpcError) throw rpcError;

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
      queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
      queryClient.invalidateQueries({ queryKey: ["tipStats"] });
      showSuccess("Conta fechada com sucesso!");
      onOpenChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleDiscountRequested = () => {
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
    
    if (produtoSelecionado.tipo === 'rodizio') {
        nomeProdutoFinal = `[RODIZIO] ${values.nome_produto}`;
        requerPreparo = false;
    }
    
    if (produtoSelecionado.tipo === 'componente_rodizio') {
        requerPreparo = produtoSelecionado.requer_preparo; 
    }
    
    let status: ItemPedido['status'] = 'pendente';

    addItemMutation.mutate({ 
        ...values, 
        nome_produto: nomeProdutoFinal,
        status: status,
        requer_preparo: requerPreparo,
    });
  };
  
  const handlePartialPaymentOpen = (cliente: Cliente) => {
    const items = getItemsToPayIndividual(cliente.id);
    if (items.length === 0) {
        showError(`O cliente ${cliente.nome} não possui itens individuais para pagar.`);
        return;
    }
    setClientePagandoIndividual(cliente);
  };
  
  const handleMesaItemPartialPaymentOpen = (item: GroupedItem) => {
    if (!ocupantes || ocupantes.length === 0) {
        showError("Não há clientes ocupando a mesa para atribuir o pagamento.");
        return;
    }
    setItemMesaToPay(item);
    setQuantidadePagarMesa(item.total_quantidade);
    setClientePagandoMesaId(ocupantes[0].id);
    setIsMesaItemPartialPaymentOpen(true);
  };
  
  const payMesaItemPartialMutation = useMutation({
    mutationFn: async ({ itemId, quantidade, clienteId }: { itemId: string, quantidade: number, clienteId: string }) => {
      if (!pedido) throw new Error("Pedido não encontrado.");
      
      const originalGroupedItem = itensMesaGeral.find(i => i.id === itemId);
      if (!originalGroupedItem) throw new Error("Item da mesa não encontrado.");
      if (quantidade > originalGroupedItem.total_quantidade) throw new Error("Quantidade a pagar excede a quantidade restante.");
      
      const originalItemIds = originalGroupedItem.original_ids;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const precoUnitarioComDesconto = originalGroupedItem.subtotal / originalGroupedItem.total_quantidade;
      const subtotalItem = precoUnitarioComDesconto * quantidade;
      const gorjetaParcial = tipEnabled ? subtotalItem * 0.1 : 0;

      const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
        user_id: user.id, 
        cliente_id: clienteId, 
        status: 'pago', 
        closed_at: new Date().toISOString(), 
        mesa_id: mesa!.id, 
        acompanhantes: pedido.acompanhantes,
        gorjeta_valor: gorjetaParcial,
        garcom_id: selectedGarcomId,
      }).select("id").single();
      if (newPedidoError) throw newPedidoError;
      const newPedidoId = newPedido.id;

      if (quantidade === originalGroupedItem.total_quantidade) {
        // Pagamento total: move todos os IDs originais
        const { error: moveError } = await supabase.from("itens_pedido")
          .update({ pedido_id: newPedidoId, consumido_por_cliente_id: clienteId, updated_at: new Date().toISOString() })
          .in("id", originalItemIds);
        if (moveError) throw moveError;
      } else {
        // Pagamento parcial: dividir os IDs originais proporcionalmente
        let quantidadeRestante = quantidade;
        for (const originalId of originalItemIds) {
          if (quantidadeRestante <= 0) break;

          // Buscar o item original para saber a quantidade disponível
          const { data: originalItem, error: originalItemError } = await supabase
            .from("itens_pedido")
            .select("*")
            .eq("id", originalId)
            .single();
          if (originalItemError || !originalItem) throw new Error("Erro ao buscar item original para pagamento parcial.");

          const quantidadeParaPagar = Math.min(quantidadeRestante, originalItem.quantidade);

          if (quantidadeParaPagar === originalItem.quantidade) {
            // Move o item inteiro
            const { error: moveError } = await supabase.from("itens_pedido")
              .update({ pedido_id: newPedidoId, consumido_por_cliente_id: clienteId, updated_at: new Date().toISOString() })
              .eq("id", originalId);
            if (moveError) throw moveError;
          } else {
            // Divide o item: atualiza o original e insere um novo para a quantidade paga
            const { error: updateError } = await supabase.from("itens_pedido")
              .update({ quantidade: originalItem.quantidade - quantidadeParaPagar, updated_at: new Date().toISOString() })
              .eq("id", originalId);
            if (updateError) throw updateError;

            const { error: insertError } = await supabase.from("itens_pedido").insert({
              pedido_id: newPedidoId,
              user_id: user.id,
              nome_produto: originalItem.nome_produto,
              quantidade: quantidadeParaPagar,
              preco: originalItem.preco,
              consumido_por_cliente_id: clienteId,
              desconto_percentual: originalItem.desconto_percentual,
              desconto_motivo: originalItem.desconto_motivo,
              status: originalItem.status,
              requer_preparo: originalItem.requer_preparo,
              cozinheiro_id: originalItem.cozinheiro_id,
              hora_inicio_preparo: originalItem.hora_inicio_preparo,
              hora_entrega: originalItem.hora_entrega,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            if (insertError) throw insertError;
          }

          quantidadeRestante -= quantidadeParaPagar;
        }
      }

      const { count: remainingClientItems } = await supabase.from("itens_pedido")
        .select('*', { count: 'exact', head: true })
        .eq("pedido_id", pedido.id)
        .eq("consumido_por_cliente_id", clienteId);
        
      if (remainingClientItems === 0) {
        await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesa!.id).eq("cliente_id", clienteId);
      }

      const { count: remainingItemsCount } = await supabase.from("itens_pedido")
        .select('*', { count: 'exact', head: true })
        .eq("pedido_id", pedido.id);
        
      const { count: remainingOccupantsCount } = await supabase.from("mesa_ocupantes")
        .select('*', { count: 'exact', head: true })
        .eq("mesa_id", mesa!.id);

      if (remainingItemsCount === 0) {
        await supabase.from('pedidos').update({ status: 'pago', closed_at: new Date().toISOString() }).eq('id', pedido.id);
      }
      
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
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["tipStats"] });
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
  
  const precoUnitarioComDescontoMesa = useMemo(() => {
    if (!itemMesaToPay) return 0;
    return itemMesaToPay.subtotal / itemMesaToPay.total_quantidade;
  }, [itemMesaToPay]);

  return (
    <>
      {/* ... restante do componente permanece igual ... */}
    </>
  );
}