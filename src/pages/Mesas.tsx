import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mesa, Cliente } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MesaForm } from "@/components/mesas/MesaForm";
import { AssignClienteDialog } from "@/components/mesas/AssignClienteDialog";
import { PlusCircle, MoreHorizontal, Trash2, Edit, UserPlus, UserMinus } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";

async function fetchMesas(): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("*, cliente:clientes(id, nome)")
    .order("numero", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

async function fetchClientes(): Promise<Pick<Cliente, 'id' | 'nome'>[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

export default function MesasPage() {
  const queryClient = useQueryClient();
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);

  const { data: mesas, isLoading, isError } = useQuery({
    queryKey: ["mesas"],
    queryFn: fetchMesas,
  });

  const { data: clientes, isLoading: isLoadingClientes } = useQuery({
    queryKey: ["clientes_list"],
    queryFn: fetchClientes,
  });

  const handleFormDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingMesa(null);
    }
    setIsFormDialogOpen(isOpen);
  };

  const addMesaMutation = useMutation({
    mutationFn: async (newMesa: { numero: number; capacidade: number }) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("mesas").insert([{ ...newMesa, user_id: userId }]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa adicionada com sucesso!");
      handleFormDialogChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const editMesaMutation = useMutation({
    mutationFn: async (updatedMesa: { id: string; numero: number; capacidade: number }) => {
      const { id, ...mesaInfo } = updatedMesa;
      const { error } = await supabase.from("mesas").update(mesaInfo).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa atualizada com sucesso!");
      handleFormDialogChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const deleteMesaMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      const { error } = await supabase.from("mesas").delete().eq("id", mesaId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa excluída com sucesso!");
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const assignClienteMutation = useMutation({
    mutationFn: async ({ mesaId, clienteId }: { mesaId: string; clienteId: string }) => {
      const { error } = await supabase.from("mesas").update({ cliente_id: clienteId }).eq("id", mesaId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa ocupada com sucesso!");
      setIsAssignDialogOpen(false);
      setSelectedMesa(null);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const unassignClienteMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      const { error } = await supabase.from("mesas").update({ cliente_id: null }).eq("id", mesaId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Mesa liberada com sucesso!");
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleFormSubmit = (values: { numero: number; capacidade: number }) => {
    if (editingMesa) {
      editMesaMutation.mutate({ ...values, id: editingMesa.id });
    } else {
      addMesaMutation.mutate(values);
    }
  };

  const handleAssignSubmit = (clienteId: string) => {
    if (selectedMesa) {
      assignClienteMutation.mutate({ mesaId: selectedMesa.id, clienteId });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mesas</h1>
          <p className="text-gray-600 mt-2">
            Gerencie as mesas do seu estabelecimento.
          </p>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={handleFormDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMesa ? "Editar Mesa" : "Adicionar Nova Mesa"}</DialogTitle>
            </DialogHeader>
            <MesaForm
              onSubmit={handleFormSubmit}
              isSubmitting={addMesaMutation.isPending || editMesaMutation.isPending}
              defaultValues={editingMesa || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {isLoading ? (
          <p>Carregando mesas...</p>
        ) : isError ? (
          <p className="text-red-500">Erro ao carregar mesas.</p>
        ) : mesas && mesas.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mesas.map((mesa) => (
                <TableRow key={mesa.id}>
                  <TableCell>{mesa.numero}</TableCell>
                  <TableCell>{mesa.capacidade} pessoas</TableCell>
                  <TableCell>
                    {mesa.cliente ? (
                      <Badge>Ocupada</Badge>
                    ) : (
                      <Badge variant="secondary">Livre</Badge>
                    )}
                  </TableCell>
                  <TableCell>{mesa.cliente?.nome || "-"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {mesa.cliente ? (
                          <DropdownMenuItem onClick={() => unassignClienteMutation.mutate(mesa.id)}>
                            <UserMinus className="w-4 h-4 mr-2" />
                            Liberar Mesa
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => { setSelectedMesa(mesa); setIsAssignDialogOpen(true); }}>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Ocupar Mesa
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingMesa(mesa);
                            setIsFormDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() => deleteMesaMutation.mutate(mesa.id)}
                          disabled={deleteMesaMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhuma mesa cadastrada ainda.</p>
            <p className="text-gray-500">
              Clique em "Adicionar Mesa" para começar.
            </p>
          </div>
        )}
      </div>
      <AssignClienteDialog
        isOpen={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        clientes={clientes || []}
        onSubmit={handleAssignSubmit}
        isSubmitting={assignClienteMutation.isPending || isLoadingClientes}
      />
    </div>
  );
}