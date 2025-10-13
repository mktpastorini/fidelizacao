import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mesa } from "@/types/supabase";
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
} from "@/components/ui/dropdown-menu";
import { MesaForm } from "@/components/mesas/MesaForm";
import { PlusCircle, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

async function fetchMesas(): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from("mesas")
    .select("*")
    .order("numero", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export default function MesasPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null);

  const { data: mesas, isLoading, isError } = useQuery({
    queryKey: ["mesas"],
    queryFn: fetchMesas,
  });

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingMesa(null);
    }
    setIsDialogOpen(isOpen);
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
      handleDialogChange(false);
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
      handleDialogChange(false);
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

  const handleSubmit = (values: { numero: number; capacidade: number }) => {
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
          <h1 className="text-3xl font-bold">Mesas</h1>
          <p className="text-gray-600 mt-2">
            Gerencie as mesas do seu estabelecimento.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
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
              onSubmit={handleSubmit}
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
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mesas.map((mesa) => (
                <TableRow key={mesa.id}>
                  <TableCell>{mesa.numero}</TableCell>
                  <TableCell>{mesa.capacidade} pessoas</TableCell>
                  <TableCell>{mesa.cliente_id ? "Ocupada" : "Livre"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingMesa(mesa);
                            setIsDialogOpen(true);
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
    </div>
  );
}