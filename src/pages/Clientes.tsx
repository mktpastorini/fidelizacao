import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDesc,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { ClienteCard } from "@/components/clientes/ClienteCard";
import { ClienteDetalhesModal } from "@/components/clientes/ClienteDetalhesModal";
import { PlusCircle, Search } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Input } from "@/components/ui/input";

async function fetchClientes(searchTerm: string): Promise<Cliente[]> {
  let query = supabase
    .from("clientes")
    .select("*, filhos(*)")
    .order("created_at", { ascending: false });

  if (searchTerm) {
    query = query.ilike("nome", `%${searchTerm}%`);
  }

  const { data: clientes, error: clientesError } = await query;

  if (clientesError) {
    throw new Error(clientesError.message);
  }

  return clientes || [];
}

export default function ClientesPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetalhesOpen, setIsDetalhesOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ["clientes", debouncedSearchTerm],
    queryFn: () => fetchClientes(debouncedSearchTerm),
  });

  const handleFormOpen = (cliente: Cliente | null = null) => {
    setEditingCliente(cliente);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingCliente(null);
    setIsFormOpen(false);
  };

  const handleDetalhesOpen = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setIsDetalhesOpen(true);
  };

  const addClienteMutation = useMutation({
    mutationFn: async (newCliente: any) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      let gostos = null;
      try {
        if (newCliente.gostos) gostos = JSON.parse(newCliente.gostos);
      } catch (e) {
        throw new Error("Formato de 'Gostos' inválido. Use JSON.");
      }

      const { filhos, ...clienteDataToInsert } = newCliente;
      const { data: clienteData, error: clienteError } = await supabase.from("clientes").insert([{ ...clienteDataToInsert, gostos, user_id: userId }]).select().single();
      if (clienteError) throw new Error(clienteError.message);

      if (filhos && filhos.length > 0) {
        const filhosData = filhos.map((filho: any) => ({ ...filho, cliente_id: clienteData.id, user_id: userId }));
        const { error: filhosError } = await supabase.from("filhos").insert(filhosData);
        if (filhosError) throw new Error(filhosError.message);
      }
      
      if (clienteData.avatar_url) {
        const { error: faceError } = await supabase.functions.invoke('register-face', {
          body: { cliente_id: clienteData.id, image_url: clienteData.avatar_url },
        });
        if (faceError) {
          showError(`Cliente criado, mas falha ao registrar o rosto: ${faceError.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente adicionado com sucesso!");
      handleFormClose();
    },
    onError: (error: Error) => showError(error.message),
  });

  const editClienteMutation = useMutation({
    mutationFn: async (updatedCliente: any) => {
      const { id, filhos, ...clienteInfo } = updatedCliente;
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      let gostos = null;
      try {
        if (clienteInfo.gostos) gostos = JSON.parse(clienteInfo.gostos);
      } catch (e) {
        throw new Error("Formato de 'Gostos' inválido. Use JSON.");
      }

      const { error: clienteError } = await supabase.from("clientes").update({ ...clienteInfo, gostos }).eq("id", id);
      if (clienteError) throw new Error(clienteError.message);

      await supabase.from("filhos").delete().eq("cliente_id", id);

      if (filhos && filhos.length > 0) {
        const filhosData = filhos.map((filho: any) => ({ nome: filho.nome, idade: filho.idade, cliente_id: id, user_id: userId }));
        const { error: insertFilhosError } = await supabase.from("filhos").insert(filhosData);
        if (insertFilhosError) throw new Error(insertFilhosError.message);
      }

      if (clienteInfo.avatar_url) {
        const { error: faceError } = await supabase.functions.invoke('register-face', {
          body: { cliente_id: id, image_url: clienteInfo.avatar_url },
        });
        if (faceError) {
          showError(`Cliente atualizado, mas falha ao registrar o rosto: ${faceError.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente atualizado com sucesso!");
      handleFormClose();
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteClienteMutation = useMutation({
    mutationFn: async (clienteId: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente excluído com sucesso!");
      setClienteToDelete(null);
    },
    onError: (error: Error) => showError(error.message),
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Clientes</h1>
        <p className="text-gray-600 mt-2">Gerencie as informações dos seus clientes aqui.</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Cliente</Button>
      </div>

      {isLoading ? <p>Carregando clientes...</p> : isError ? <p className="text-red-500">Erro ao carregar clientes.</p> : clientes && clientes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientes.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onView={() => handleDetalhesOpen(cliente)}
              onEdit={() => handleFormOpen(cliente)}
              onDelete={() => setClienteToDelete(cliente)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">{debouncedSearchTerm ? `Nenhum cliente encontrado para "${debouncedSearchTerm}".` : "Nenhum cliente cadastrado ainda."}</p>
          {!debouncedSearchTerm && <p className="text-gray-500">Clique em "Adicionar Cliente" para começar.</p>}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCliente ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
            <DialogDescription>
              Preencha as informações abaixo. A foto é usada para o reconhecimento facial.
            </DialogDescription>
          </DialogHeader>
          <ClienteForm onSubmit={handleSubmit} isSubmitting={addClienteMutation.isPending || editClienteMutation.isPending} defaultValues={editingCliente || undefined} />
        </DialogContent>
      </Dialog>

      <ClienteDetalhesModal isOpen={isDetalhesOpen} onOpenChange={setIsDetalhesOpen} cliente={selectedCliente} />

      {clienteToDelete && (
        <AlertDialog open={!!clienteToDelete} onOpenChange={() => setClienteToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDesc>
                Tem certeza que deseja excluir {clienteToDelete.nome}? Esta ação não pode ser desfeita.
              </AlertDialogDesc>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setClienteToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteClienteMutation.mutate(clienteToDelete.id)}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}