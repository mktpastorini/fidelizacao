import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, ItemPedido, StaffProfile } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Star, DollarSign, Users, CreditCard, UserCheck, CheckSquare } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { showError, showSuccess } from "@/utils/toast";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";

type PaymentModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
  tableData: {
    mesa_id: string;
    mesa_numero: number;
    pedido: {
      id: string;
      itens_pedido: ItemPedido[];
    };
    ocupantes: { id: string; nome: string }[];
  } | null;
  waiters: StaffProfile[];
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcularPrecoComDesconto = (item: ItemPedido) => {
  const precoTotal = (item.preco || 0) * item.quantidade;
  const desconto = precoTotal * ((item.desconto_percentual || 0) / 100);
  return precoTotal - desconto;
};

export function PaymentModal({ isOpen, onOpenChange, cliente, tableData, waiters }: PaymentModalProps) {
  const queryClient = useQueryClient();
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [paymentType, setPaymentType] = useState<'individual' | 'total' | 'parcial' | null>(null);
  const [tipEnabled, setTipEnabled] = useState(false);
  const [selectedGarcomId, setSelectedGarcomId] = useState<string | null>(null);

  const { groupedItems, totalMesa } = useMemo(() => {
    if (!tableData?.pedido?.itens_pedido) {
      return { groupedItems: [], totalMesa: 0 };
    }

    const totalMesa = tableData.pedido.itens_pedido.reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0);
    
    const itemsByConsumer = new Map<string, ItemPedido[]>();
    tableData.pedido.itens_pedido.forEach(item => {
      const key = item.consumido_por_cliente_id || 'mesa';
      if (!itemsByConsumer.has(key)) {
        itemsByConsumer.set(key, []);
      }
      itemsByConsumer.get(key)!.push(item);
    });

    const allConsumers = new Map<string, string>();
    tableData.ocupantes.forEach(o => allConsumers.set(o.id, o.nome));
    if (itemsByConsumer.has('mesa')) {
      allConsumers.set('mesa', 'Mesa (Geral)');
    }

    const grouped = Array.from(allConsumers.entries()).map(([id, nome]) => ({
      id,
      nome,
      itens: itemsByConsumer.get(id) || [],
      subtotal: (itemsByConsumer.get(id) || []).reduce((acc, item) => acc + calcularPrecoComDesconto(item), 0),
    })).filter(g => g.itens.length > 0);

    return { groupedItems: grouped, totalMesa };
  }, [tableData]);

  const selectedTotal = useMemo(() => {
    return Array.from(selectedItemIds).reduce((acc, itemId) => {
      const item = tableData?.pedido.itens_pedido.find(i => i.id === itemId);
      return acc + (item ? calcularPrecoComDesconto(item) : 0);
    }, 0);
  }, [selectedItemIds, tableData]);

  const handleSelectAllFromGroup = (groupId: string, checked: boolean) => {
    const group = groupedItems.find(g => g.id === groupId);
    if (!group) return;

    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      group.itens.forEach(item => {
        if (checked) newSet.add(item.id);
        else newSet.delete(item.id);
      });
      return newSet;
    });
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(itemId);
      else newSet.delete(itemId);
      return newSet;
    });
  };

  const handlePayment = (type: 'individual' | 'total' | 'parcial') => {
    setPaymentType(type);
  };

  const resetPaymentState = () => {
    setPaymentType(null);
    setTipEnabled(false);
    setSelectedGarcomId(null);
    setSelectedItemIds(new Set());
  };

  const onDialogClose = (open: boolean) => {
    if (!open) {
      resetPaymentState();
    }
    onOpenChange(open);
  };

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["pedidoAberto"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Pagamento processado com sucesso!");
      onDialogClose(false);
    },
    onError: (error: Error) => showError(error.message),
  };

  const payIndividualMutation = useMutation({ mutationFn: async (payload: any) => { const { error } = await supabase.rpc('finalizar_pagamento_parcial_cliente', payload); if (error) throw error; }, ...mutationOptions });
  const payTotalMutation = useMutation({ mutationFn: async (payload: any) => { const { error } = await supabase.rpc('finalizar_pagamento_total', payload); if (error) throw error; }, ...mutationOptions });
  const payPartialMutation = useMutation({ mutationFn: async (payload: any) => { const { error } = await supabase.rpc('finalizar_pagamento_itens_parciais', payload); if (error) throw error; }, ...mutationOptions });

  const handleConfirmPayment = () => {
    if (!cliente || !tableData || !paymentType) return;

    let totalToCalculateTip = 0;
    if (paymentType === 'individual') totalToCalculateTip = groupedItems.find(g => g.id === cliente.id)?.subtotal || 0;
    if (paymentType === 'total') totalToCalculateTip = totalMesa;
    if (paymentType === 'parcial') totalToCalculateTip = selectedTotal;

    const gorjeta = tipEnabled ? totalToCalculateTip * 0.1 : 0;

    if (tipEnabled && !selectedGarcomId) {
      showError("Por favor, selecione o garçom para a gorjeta.");
      return;
    }

    if (paymentType === 'individual') {
      payIndividualMutation.mutate({ p_pedido_id: tableData.pedido.id, p_cliente_id: cliente.id, p_gorjeta_valor: gorjeta, p_garcom_id: selectedGarcomId });
    } else if (paymentType === 'total') {
      payTotalMutation.mutate({ p_pedido_id: tableData.pedido.id, p_mesa_id: tableData.mesa_id });
    } else if (paymentType === 'parcial') {
      const itensAPagar = Array.from(selectedItemIds).map(id => {
        const item = tableData.pedido.itens_pedido.find(i => i.id === id);
        return { item_id: id, quantidade: item!.quantidade };
      });
      payPartialMutation.mutate({ p_pedido_id: tableData.pedido.id, p_cliente_id: cliente.id, p_itens_a_pagar: itensAPagar, p_gorjeta_valor: gorjeta, p_garcom_id: selectedGarcomId });
    }
  };

  if (!cliente || !tableData) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onDialogClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="text-center">
            <Avatar className="w-24 h-24 mx-auto mb-4 ring-2 ring-primary ring-offset-4 ring-offset-card"><AvatarImage src={cliente.avatar_url || undefined} /><AvatarFallback><User className="w-12 h-12" /></AvatarFallback></Avatar>
            <DialogTitle className="text-2xl">{cliente.nome}</DialogTitle>
            <DialogDescription>Mesa {tableData.mesa_numero} - Pontos: {cliente.pontos}</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0 pr-4">
            <Accordion type="multiple" defaultValue={groupedItems.map(g => g.id)} className="w-full space-y-4">
              {groupedItems.map(group => (
                <AccordionItem key={group.id} value={group.id} className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={group.itens.every(item => selectedItemIds.has(item.id))}
                          onCheckedChange={(checked) => handleSelectAllFromGroup(group.id, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-semibold">{group.nome}</span>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(group.subtotal)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-2">
                    <Table>
                      <TableBody>
                        {group.itens.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="w-10"><Checkbox checked={selectedItemIds.has(item.id)} onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)} /></TableCell>
                            <TableCell>{item.quantidade}x {item.nome_produto}</TableCell>
                            <TableCell className="text-right">{formatCurrency(calcularPrecoComDesconto(item))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center pt-4 border-t">
            <div className="text-xl font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Total da Mesa: {formatCurrency(totalMesa)}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handlePayment('individual')}><UserCheck className="w-4 h-4 mr-2" />Pagar Conta Individual</Button>
              <Button variant="outline" onClick={() => handlePayment('parcial')} disabled={selectedItemIds.size === 0}><CheckSquare className="w-4 h-4 mr-2" />Pagar Selecionados ({formatCurrency(selectedTotal)})</Button>
              <Button onClick={() => handlePayment('total')}><CreditCard className="w-4 h-4 mr-2" />Pagar Conta Total</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!paymentType} onOpenChange={(open) => !open && resetPaymentState()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
            <AlertDialogDescription>Revise os detalhes antes de finalizar.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between"><p>Subtotal:</p><p className="font-semibold">{formatCurrency(paymentType === 'individual' ? (groupedItems.find(g => g.id === cliente.id)?.subtotal || 0) : paymentType === 'total' ? totalMesa : selectedTotal)}</p></div>
            <div className="flex items-center justify-between"><Switch id="tip-toggle" checked={tipEnabled} onCheckedChange={setTipEnabled} /><Label htmlFor="tip-toggle">Adicionar Gorjeta (10%)</Label></div>
            {tipEnabled && (
              <>
                <div className="flex items-center justify-between text-primary"><p>Gorjeta:</p><p className="font-semibold">{formatCurrency((paymentType === 'individual' ? (groupedItems.find(g => g.id === cliente.id)?.subtotal || 0) : paymentType === 'total' ? totalMesa : selectedTotal) * 0.1)}</p></div>
                <Select onValueChange={setSelectedGarcomId}><SelectTrigger><SelectValue placeholder="Selecione o garçom" /></SelectTrigger><SelectContent>{waiters.map(w => <SelectItem key={w.id} value={w.id}>{w.first_name} {w.last_name}</SelectItem>)}</SelectContent></Select>
              </>
            )}
            <div className="flex items-center justify-between text-xl font-bold pt-2 border-t"><p>Total a Pagar:</p><p>{formatCurrency((paymentType === 'individual' ? (groupedItems.find(g => g.id === cliente.id)?.subtotal || 0) : paymentType === 'total' ? totalMesa : selectedTotal) * (tipEnabled ? 1.1 : 1))}</p></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPayment} disabled={payIndividualMutation.isPending || payTotalMutation.isPending || payPartialMutation.isPending}>
              {payIndividualMutation.isPending || payTotalMutation.isPending || payPartialMutation.isPending ? "Processando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}