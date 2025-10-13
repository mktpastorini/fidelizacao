import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente } from "@/types/supabase";
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
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { PlusCircle, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";

async function fetchClientes(): Promise<Cliente[]> {
  const { data: clientes, error: clientesError } = await supabase
    .from("clientes")
    .select("*, filhos(*)")
    .order("created_at", { ascending: false });

  if (clientesError) {
    throw new Error(clientesError.message);
  }

  return clientes || [];
}

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ["clientes"],
    queryFn: fetchClientes,
  });

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingCliente(null);
    }
    setIsDialogOpen(isOpen);
  };

  const addClienteMutation = useMutation({
    mutationFn: async (newCliente: any) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      let gostos = null;
      try {
        if (newCliente.gostos) {
          gostos = JSON.parse(newCliente.gostos);
        }
      } catch (e) {
        throw new Error("Formato de 'Gostos' inválido. Use JSON.");
      }

      const { data: clienteData, error: clienteError } = await supabase
        .from("clientes")
        .insert([
          {
            nome: newCliente.nome,
            casado_com: newCliente.casado_com,
            whatsapp: newCliente.whatsapp,
            gostos: gostos,
            user_id: userId,
          },
        ])
        .select()
        .single();

      if (clienteError) throw new Error(clienteError.message);

      if (newCliente.filhos && newCliente.filhos.length > 0) {
        const filhosData = newCliente.filhos.map((filho: any) => ({
          ...filho,
          cliente_id: clienteData.id,
          user_id: userId,
        }));
        const { error: filhosError } = await supabase.from("filhos").insert(filhosData);
        if (filhosError) throw new Error(filhosError.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente adicionado com sucesso!");
      handleDialogChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const editClienteMutation = useMutation({
    mutationFn: async (updatedCliente: any) => {
      const { id, filhos, ...clienteInfo } = updatedCliente;
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      let gostos = null;
      try {
        if (clienteInfo.gostos) {
          gostos = JSON.parse(clienteInfo.gostos);
        }
      } catch (e) {
        throw new Error("Formato de 'Gostos' inválido. Use JSON.");
      }

      const { error: clienteError } = await supabase
        .from("clientes")
        .update({ ...clienteInfo, gostos })
        .eq("id", id);
      if (clienteError) throw new Error(clienteError.message);

      const { error: deleteFilhosError } = await supabase.from("filhos").delete().eq("cliente_id", id);
      if (deleteFilhosError) throw new Error(deleteFilhosError.message);

      if (filhos && filhos.length > 0) {
        const filhosData = filhos.map((filho: any) => ({
          nome: filho.nome,
          idade: filho.idade,
          cliente_id: id,
          user_id: userId,
        }));
        const { error: insertFilhosError } = await supabase.from("filhos").insert(filhosData);
        if (insertFilhosError) throw new Error(insertFilhosError.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente atualizado com sucesso!");
      handleDialogChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const deleteClienteMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente excluído com sucesso!");
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleSubmit = (values: any) => {
    if (editingCliente) {
      editClienteMutation.mutate({ ...values, id: editingCliente.id });
    } else {
      addClienteMutation.mutate(values);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-gray-600 mt-2">
            Gerencie as informações dos seus clientes aqui.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCliente ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <ClienteForm
              onSubmit={handleSubmit}
              isSubmitting={addClienteMutation.isPending || editClienteMutation.isPending}
              defaultValues={editingCliente || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {isLoading ? (
          <p>Carregando clientes...</p>
        ) : isError ? (
          <p className="text-red-500">Erro ao carregar clientes.</p>
        ) : clientes && clientes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Cliente Desde</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell>{cliente.nome}</TableCell>
                  <TableCell>{cliente.whatsapp || "-"}</TableCell>
                  <TableCell>
                    {format(new Date(cliente.cliente_desde), "dd/MM/yyyy")}
                  </TableCell>
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
                            setEditingCliente(cliente);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() => deleteClienteMutation.mutate(cliente.id)}
                          disabled={deleteClienteMutation.isPending}
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
            <p className="text-gray-500">Nenhum cliente cadastrado ainda.</p>
            <p className="text-gray-500">
              Clique em "Adicionar Cliente" para começar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}