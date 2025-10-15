import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Cliente } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MesaForm } from "@/components/mesas/MesaForm";
import { OcuparMesaDialog } from "@/components/mesas/OcuparMesaDialog";
import { PedidoModal } from "@/components/mesas/PedidoModal";
import { MesaCard } from "@/components/mesas/MesaCard";
import { PlusCircle, UserMinus, MoreVertical, Edit, Trash2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
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

type Ocupante = {
  cliente: {
    id: string;
    nome: string;
  } | null;
};

type MesaComOcupantes = Mesa & { ocupantes: Ocupante[] };

async function fetchMesas(): Promise<MesaComOcupantes[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("*, cliente:clientes(id, nome), ocupantes:mesa_ocupantes(cliente:clientes(id, nome))")
    .order("numero", { ascending: true });
  if (error) throw new Error(error.message);
  
  return data || [];
}

async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

export default function MesasPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isOcuparMesaOpen, setIsOcuparMesaOpen] = useState(false);
  const [isPedidoOpen, setIsPedidoOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [mesaToFree, setMesaToFree] = useState<Mesa | null>(null);

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
    },
    onError: (err: Error) => showError(err.message),
  });

  const ocuparMesaMutation = useMutation({
    mutationFn: async ({ clientePrincipalId, acompanhanteIds }: { clientePrincipalId: string, acompanhanteIds: string[] }) => {
      if (!selectedMesa) throw new Error("Nenhuma mesa selecionada");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { error: mesaError } = await supabase.from("mesas").update({ cliente_id: clientePrincipalId }).eq("id", selectedMesa.id);
      if (mesaError) throw new Error(`Erro ao ocupar mesa: ${mesaError.message}`);

      await supabase.from("mesa_ocupantes").delete().eq("mesa_id", selectedMesa.id);
      const todosOcupantes = [clientePrincipalId, ...acompanhanteIds];
      const ocupantesData = todosOcupantes.map(clienteId => ({
        mesa_id: selectedMesa.id,
        cliente_id: clienteId,
        user_id: user.id,
      }));
      const { error: ocupantesError } = await supabase.from("mesa_ocupantes").insert(ocupantesData);
      if (ocupantesError) throw new Error(`Erro ao adicionar ocupantes: ${ocupantesError.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa ocupada com sucesso!");
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Painel de Mesas</h1>
          <p className="text-gray-600 mt-2">Visualize a ocupação e gerencie os pedidos.</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={!mesas?.some(m => !!m.cliente_id)}>
                <UserMinus className="w-4 h-4 mr-2" />
                Liberar Todas as Mesas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá liberar todas as mesas ocupadas e cancelar quaisquer pedidos abertos associados a elas. Deseja continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => mesas?.forEach(m => m.cliente_id && unassignClienteMutation.mutate(m.id))}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Mesa</Button>
        </div>
      </div>

      {isLoading ? <p>Carregando mesas...</p> : isError ? <p className="text-red-500">Erro ao carregar mesas.</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {mesas?.map((mesa) => (
            <MesaCard key={mesa.id} mesa={mesa} onClick={() => handleMesaClick(mesa)}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {mesa.cliente_id && (
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMesaToFree(mesa); }}>
                      <UserMinus className="w-4 h-4 mr-2" /> Liberar Mesa
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleFormOpen(mesa)}>
                    <Edit className="w-4 h-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir a Mesa {mesa.numero}? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMesaMutation.mutate(mesa.id)}>
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </MesaCard>
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
        onSubmit={(clientePrincipalId, acompanhanteIds) => ocuparMesaMutation.mutate({ clientePrincipalId, acompanhanteIds })}
        isSubmitting={ocuparMesaMutation.isPending}
      />
      <PedidoModal
        isOpen={isPedidoOpen}
        onOpenChange={setIsPedidoOpen}
        mesa={selectedMesa}
      />

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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}