import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Cliente } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MesaForm } from "@/components/mesas/MesaForm";
import { AssignClienteDialog } from "@/components/mesas/AssignClienteDialog";
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

async function fetchMesas(): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("*, cliente:clientes(id, nome)")
    .order("numero", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchClientes(): Promise<Pick<Cliente, 'id' | 'nome'>[]> {
  const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

export default function MesasPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isPedidoOpen, setIsPedidoOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);

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

  const assignClienteMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      if (!selectedMesa) throw new Error("Nenhuma mesa selecionada");
      const { error } = await supabase.from("mesas").update({ cliente_id: clienteId }).eq("id", selectedMesa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa ocupada!");
      setIsAssignOpen(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const unassignClienteMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      const { error } = await supabase.from("mesas").update({ cliente_id: null }).eq("id", mesaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa liberada!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleMesaClick = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    if (mesa.cliente_id) {
      setIsPedidoOpen(true);
    } else {
      setIsAssignOpen(true);
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
                  Esta ação irá liberar todas as mesas ocupadas. Os pedidos abertos não serão fechados.
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

      <AssignClienteDialog
        isOpen={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        clientes={clientes || []}
        onSubmit={assignClienteMutation.mutate}
        isSubmitting={assignClienteMutation.isPending}
      />
      <PedidoModal
        isOpen={isPedidoOpen}
        onOpenChange={setIsPedidoOpen}
        mesa={selectedMesa}
      />
    </div>
  );
}