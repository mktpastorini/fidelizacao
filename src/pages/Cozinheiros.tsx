import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cozinheiro } from "@/types/supabase";
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
} from "@/components/ui/alert-dialog";
import { CookForm } from "@/components/cozinheiros/CookForm";
import { CookCard } from "@/components/cozinheiros/CookCard";
import { PlusCircle, Search } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

async function fetchCozinheiros(searchTerm: string): Promise<Cozinheiro[]> {
  let query = supabase
    .from("cozinheiros")
    .select("*")
    .order("nome", { ascending: true });

  if (searchTerm) {
    query = query.ilike("nome", `%${searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

export default function CozinheirosPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCozinheiro, setEditingCozinheiro] = useState<Cozinheiro | null>(null);
  const [cozinheiroToDelete, setCozinheiroToDelete] = useState<Cozinheiro | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: cozinheiros, isLoading, isError } = useQuery({
    queryKey: ["cozinheiros", searchTerm],
    queryFn: () => fetchCozinheiros(searchTerm),
  });

  const handleFormOpen = (cozinheiro: Cozinheiro | null = null) => {
    setEditingCozinheiro(cozinheiro);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingCozinheiro(null);
    setIsFormOpen(false);
  };

  const addCozinheiroMutation = useMutation({
    mutationFn: async (newCook: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { avatar_urls, ...cookData } = newCook;
      
      if (!avatar_urls || avatar_urls.length === 0) {
        throw new Error("É necessário pelo menos uma foto para o reconhecimento.");
      }
      
      // 1. Insere o cozinheiro no banco de dados
      const { data: insertedCook, error: insertError } = await supabase
        .from("cozinheiros")
        .insert([{ ...cookData, user_id: user.id }])
        .select("id")
        .single();
        
      if (insertError) throw new Error(insertError.message);
      const newCookId = insertedCook.id;

      try {
        // 2. Registra as faces no CompreFace
        const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
          body: { subject: newCookId, image_urls: avatar_urls }
        });
        if (faceError) throw faceError;

      } catch (error) {
        console.error("Erro durante o registro facial do cozinheiro. Revertendo...", error);
        await supabase.from("cozinheiros").delete().eq("id", newCookId);
        throw new Error(`O cadastro do cozinheiro falhou durante o registro facial. A operação foi desfeita. Erro original: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cozinheiros"] });
      showSuccess("Cozinheiro adicionado com sucesso!");
      handleFormClose();
    },
    onError: (error: Error) => showError(error.message),
  });

  const editCozinheiroMutation = useMutation({
    mutationFn: async (updatedCook: any) => {
      const { id, avatar_urls, ...cookInfo } = updatedCook;
      
      // 1. Atualiza as informações básicas
      const { error: cookError } = await supabase.from("cozinheiros").update({ ...cookInfo }).eq("id", id);
      if (cookError) throw new Error(cookError.message);

      // 2. Se houver novas fotos, registra no CompreFace
      if (avatar_urls && avatar_urls.length > 0) {
        // NOTA: O CompreFace adiciona exemplos, não substitui.
        const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
          body: { subject: id, image_urls: avatar_urls }
        });
        if (faceError) throw new Error(`Cozinheiro atualizado, mas falha ao registrar novos rostos: ${faceError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cozinheiros"] });
      showSuccess("Cozinheiro atualizado com sucesso!");
      handleFormClose();
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteCozinheiroMutation = useMutation({
    mutationFn: async (cozinheiroId: string) => {
      // NOTA: A exclusão do cozinheiro no CompreFace deve ser feita manualmente ou via outro Edge Function,
      // mas para simplificar, focamos na exclusão do registro local.
      const { error } = await supabase.from("cozinheiros").delete().eq("id", cozinheiroId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cozinheiros"] });
      showSuccess("Cozinheiro excluído com sucesso!");
      setCozinheiroToDelete(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleSubmit = (values: any) => {
    if (editingCozinheiro) {
      editCozinheiroMutation.mutate({ ...values, id: editingCozinheiro.id });
    } else {
      addCozinheiroMutation.mutate(values);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Cozinheiros</h1>
          <p className="text-muted-foreground mt-1">Cadastre os perfis dos cozinheiros para o reconhecimento facial na cozinha.</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar cozinheiro..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Cozinheiro</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : isError ? (
        <p className="text-red-500">Erro ao carregar cozinheiros.</p>
      ) : cozinheiros && cozinheiros.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cozinheiros.map((cozinheiro) => (
            <CookCard
              key={cozinheiro.id}
              cozinheiro={cozinheiro}
              onEdit={() => handleFormOpen(cozinheiro)}
              onDelete={() => setCozinheiroToDelete(cozinheiro)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-lg">
          <p className="text-muted-foreground">Nenhum cozinheiro cadastrado ainda.</p>
          <p className="text-muted-foreground">Clique em "Adicionar Cozinheiro" para começar.</p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCozinheiro ? "Editar Cozinheiro" : "Adicionar Novo Cozinheiro"}</DialogTitle>
          </DialogHeader>
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <CookForm 
              onSubmit={handleSubmit} 
              isSubmitting={addCozinheiroMutation.isPending || editCozinheiroMutation.isPending} 
              defaultValues={editingCozinheiro || undefined}
            />
          </div>
        </DialogContent>
      </Dialog>

      {cozinheiroToDelete && (
        <AlertDialog open={!!cozinheiroToDelete} onOpenChange={() => setCozinheiroToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o cozinheiro {cozinheiroToDelete.nome}? Esta ação não pode ser desfeita e removerá o perfil de reconhecimento facial dele.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCozinheiroToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteCozinheiroMutation.mutate(cozinheiroToDelete.id)}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}