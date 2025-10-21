import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Cliente } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { MesaForm } from "@/components/mesas/MesaForm";
import { OcuparMesaDialog } from "@/components/mesas/OcuparMesaDialog";
import { PedidoModal } from "@/components/mesas/PedidoModal";
import { MesaCard } from "@/components/mesas/MesaCard";
import { PlusCircle } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { usePageActions } from "@/contexts/PageActionsContext";

type MesaComOcupantes = Mesa & { ocupantes_count: number };

async function fetchMesas(): Promise<MesaComOcupantes[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("*, cliente:clientes(id, nome), ocupantes_count:mesa_ocupantes(count)")
    .order("numero", { ascending: true });
  if (error) throw new Error(error.message);
  
  return (data || []).map(m => ({
    ...m,
    ocupantes_count: m.ocupantes_count[0]?.count || (m.cliente ? 1 : 0),
  }));
}

async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from("clientes").select("*, filhos(*)").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

export default function MesasPage() {
  const queryClient = useQueryClient();
  const { setPageActions } = usePageActions();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isOcuparMesaOpen, setIsOcuparMesaOpen] = useState(false);
  const [isPedidoOpen, setIsPedidoOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [mesaToFree, setMesaToFree] = useState<Mesa | null>(null);
  const [mesaToDelete, setMesaToDelete] = useState<Mesa | null>(null);

  const { data: mesas, isLoading, isError } = useQuery({ queryKey: ["mesas"], queryFn: fetchMesas });
  const { data: clientes } = useQuery({ queryKey: ["clientes_list"], queryFn: fetchClientes });

  const handleFormOpen = (mesa: Mesa | null = null) => {
    setEditingMesa(mesa);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingMesa(null);
    setIsFormOpen(false);
  };

  const handleOcuparMesaOpen = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setIsOcuparMesaOpen(true);
  };

  const addMesaMutation = useMutation({
    mutationFn: async (newMesa: { numero: number; capacidade: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("mesas").insert([{ ...newMesa, user_id: user?.id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa adicionada!");
      handleFormClose();
    },
    onError: (err: Error) => showError(err.message),
  });

  const editMesaMutation = useMutation({
    mutationFn: async (updatedMesa: { id: string; numero: number; capacidade: number }) => {
      const { id, ...mesaInfo } = updatedMesa;
      const { error } = await supabase.from("mesas").update(mesaInfo).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa atualizada!");
      handleFormClose();
    },
    onError: (err: Error) => showError(err.message),
  });

  const deleteMesaMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      const { error } = await supabase.from("mesas").delete().eq("id", mesaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa excluída!");
      setMesaToDelete(null);
    },
    onError: (err: Error) => showError(err.message),
  });

  const ocuparMesaMutation = useMutation({
    mutationFn: async ({ clientePrincipalId, acompanhanteIds, currentOccupantIds }: { clientePrincipalId: string, acompanhanteIds: string[], currentOccupantIds: string[] }) => {
      if (!selectedMesa) throw new Error("Nenhuma mesa selecionada");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");
  
      const todosNovosOcupantesIds = [clientePrincipalId, ...acompanhanteIds];
      const todosOcupantes = clientes?.filter(c => todosNovosOcupantesIds.includes(c.id)) || [];
      const acompanhantesJson = todosOcupantes.map(c => ({ id: c.id, nome: c.nome }));
  
      // 1. Find or create the open pedido
      let pedidoId: string | null = null;
      const { data: existingPedido, error: existingPedidoError } = await supabase
        .from("pedidos")
        .select("id")
        .eq("mesa_id", selectedMesa.id)
        .eq("status", "aberto")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPedidoError) throw existingPedidoError;

      if (existingPedido) {
        pedidoId = existingPedido.id;
        // Update existing pedido's cliente_id and acompanhantes if necessary
        await supabase.from("pedidos").update({
          cliente_id: clientePrincipalId,
          acompanhantes: acompanhantesJson,
        }).eq("id", pedidoId);
      } else {
        // Create new pedido if none exists
        const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
          mesa_id: selectedMesa.id,
          cliente_id: clientePrincipalId,
          user_id: user.id,
          status: "aberto",
          acompanhantes: acompanhantesJson,
        }).select("id").single();
        if (newPedidoError) throw newPedidoError;
        pedidoId = newPedido.id;
      }

      // 2. Update the mesa's main client
      await supabase.from("mesas").update({ cliente_id: clientePrincipalId }).eq("id", selectedMesa.id);
  
      // 3. Manage mesa_ocupantes to trigger only for new additions
      const currentOccupantSet = new Set(currentOccupantIds);
      const newOccupantSet = new Set(todosNovosOcupantesIds);

      const occupantsToRemove = currentOccupantIds.filter(id => !newOccupantSet.has(id));
      const occupantsToAdd = todosNovosOcupantesIds.filter(id => !currentOccupantSet.has(id));

      if (occupantsToRemove.length > 0) {
        await supabase.from("mesa_ocupantes").delete().eq("mesa_id", selectedMesa.id).in("cliente_id", occupantsToRemove);
      }

      if (occupantsToAdd.length > 0) {
        const ocupantesDataToInsert = occupantsToAdd.map(clienteId => ({
          mesa_id: selectedMesa.id,
          cliente_id: clienteId,
          user_id: user.id,
        }));
        await supabase.from("mesa_ocupantes").insert(ocupantesDataToInsert);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Mesa ocupada/atualizada com sucesso!");
      setIsOcuparMesaOpen(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const unassignClienteMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      let orderWasCancelled = false;
      const { data: openOrder, error: findError } = await supabase.from('pedidos').select('id').eq('mesa_id', mesaId).eq('status', 'aberto').single();
      if (findError && findError.code !== 'PGRST116') throw findError;

      if (openOrder) {
        const { error: updateError } = await supabase.from('pedidos').update({ status: 'cancelado' }).eq('id', openOrder.id);
        if (updateError) throw updateError;
        orderWasCancelled = true;
      }

      await supabase.from("mesas").update({ cliente_id: null }).eq("id", mesaId);
      await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesaId);
      return { orderWasCancelled };
    },
    onSuccess: ({ orderWasCancelled }) => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      if (orderWasCancelled) {
        showSuccess("Mesa liberada e pedido cancelado!");
      } else {
        showSuccess("Mesa liberada!");
      }
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleMesaClick = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    if (mesa.cliente_id) {
      setIsPedidoOpen(true);
    } else {
      setIsOcuparMesaOpen(true);
    }
  };

  const handleMesaSubmit = (values: { numero: number; capacidade: number }) => {
    if (editingMesa) {
      editMesaMutation.mutate({ ...values, id: editingMesa.id });
    } else {
      addMesaMutation.mutate(values);
    }
  };

  // Define os botões específicos da página para o cabeçalho
  useEffect(() => {
    const pageButtons = (
      <div className="flex items-center gap-2">
        <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Mesa</Button>
      </div>
    );
    setPageActions(pageButtons);

    return () => setPageActions(null); // Clean up on unmount
  }, [handleFormOpen, setPageActions]);

  return (
    <React.Fragment>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Painel de Mesas</h1>
        <p className="text-muted-foreground mt-2">Visualize a ocupação e gerencie os pedidos.</p>
      </div>

      {isLoading ? <p>Carregando mesas...</p> : isError ? <p className="text-destructive">Erro ao carregar mesas.</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {mesas?.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              ocupantesCount={mesa.ocupantes_count}
              onClick={() => handleMesaClick(mesa)}
              onEditMesa={() => handleFormOpen(mesa)}
              onFreeMesa={() => setMesaToFree(mesa)}
              onEditOcupantes={() => handleOcuparMesaOpen(mesa)}
              onDelete={() => setMesaToDelete(mesa)}
            />
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMesa ? "Editar Mesa" : "Adicionar Nova Mesa"}</DialogTitle></DialogHeader>
          <MesaForm
            onSubmit={handleMesaSubmit}
            isSubmitting={addMesaMutation.isPending || editMesaMutation.isPending}
            defaultValues={editingMesa || undefined}
          />
        </DialogContent>
      </Dialog>

      <OcuparMesaDialog
        isOpen={isOcuparMesaOpen}
        onOpenChange={setIsOcuparMesaOpen}
        mesa={selectedMesa}
        clientes={clientes || []}
        onSubmit={(clientePrincipalId, acompanhanteIds, currentOccupantIds) => ocuparMesaMutation.mutate({ clientePrincipalId, acompanhanteIds, currentOccupantIds })}
        isSubmitting={ocuparMesaMutation.isPending}
      />
      <PedidoModal isOpen={isPedidoOpen} onOpenChange={setIsPedidoOpen} mesa={selectedMesa} />

      <AlertDialog open={!!mesaToFree} onOpenChange={() => setMesaToFree(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar Mesa {mesaToFree?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desassociar o cliente da mesa e cancelar qualquer pedido aberto associado. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (mesaToFree) unassignClienteMutation.mutate(mesaToFree.id);
              setMesaToFree(null);
            }}>
              Sim, Liberar Mesa
            </AlertDialogAction>
          </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!mesaToDelete} onOpenChange={() => setMesaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão da Mesa {mesaToDelete?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a Mesa {mesaToDelete?.numero}? Esta ação é irreversível e removerá todos os dados associados a ela, incluindo pedidos e ocupantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (mesaToDelete) deleteMesaMutation.mutate(mesaToDelete.id);
            }} disabled={deleteMesaMutation.isPending}>
              {deleteMesaMutation.isPending ? "Excluindo..." : "Sim, Excluir Mesa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </React.Fragment>
  );
}