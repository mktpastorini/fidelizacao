import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cozinheiro } from "@/types/supabase";
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CozinheiroForm } from "@/components/cozinheiros/CozinheiroForm";
import { CozinheiroCard } from "@/components/cozinheiros/CozinheiroCard";
import { PlusCircle, Search, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { usePageActions } from "@/contexts/PageActionsContext";
import { useSuperadminId } from "@/hooks/useSuperadminId";

async function fetchCozinheiros(): Promise<Cozinheiro[]> {
  const { data, error } = await supabase
    .from("cozinheiros")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

export default function CozinheirosPage() {
  const queryClient = useQueryClient();
  const { setPageActions } = usePageActions();
  const { superadminId, isLoadingSuperadminId } = useSuperadminId();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCozinheiro, setEditingCozinheiro] = useState<Cozinheiro | null>(null);
  const [cozinheiroToDelete, setCozinheiroToDelete] = useState<Cozinheiro | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  const { data: cozinheiros, isLoading, isError } = useQuery({
    queryKey: ["cozinheiros", debouncedSearchTerm],
    queryFn: fetchCozinheiros,
  });

  // Define os botões da página no Header
  useEffect(() => {
    const pageButtons = (
      <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Cozinheiro</Button>
    );
    setPageActions(pageButtons);

    return () => setPageActions(null);
  }, [setPageActions]);

  const handleFormOpen = (cozinheiro: Cozinheiro | null = null) => {
    setEditingCozinheiro(cozinheiro);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingCozinheiro(null);
    setIsFormOpen(false);
  };

  const addCozinheiroMutation = useMutation({
    mutationFn: async (newCozinheiro: any) => {
      if (!superadminId) throw new Error("ID do Superadmin não encontrado.");
      
      const { avatar_urls, ...cozinheiroData } = newCozinheiro;
      
      // 1. Insere o cozinheiro na tabela cozinheiros
      const { data: insertedCook, error: insertError } = await supabase
        .from("cozinheiros")
        .insert([{ ...cozinheiroData, user_id: superadminId }])
        .select('id')
        .single();
        
      if (insertError) throw new Error(insertError.message);
      const newCookId = insertedCook.id;

      // 2. Registra a face no CompreFace (usando o ID do cozinheiro como subject)
      const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
        body: { subject: newCookId, image_urls: avatar_urls }
      });
      if (faceError) {
        // Se falhar o registro facial, remove o cozinheiro para evitar inconsistência
        await supabase.from("cozinheiros").delete().eq("id", newCookId);
        throw new Error(`O cadastro falhou durante o registro facial. A operação foi desfeita. Erro original: ${faceError.message}`);
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
    mutationFn: async (updatedCozinheiro: any) => {
      const { id, avatar_urls, ...cozinheiroInfo } = updatedCozinheiro;
      
      // 1. Atualiza o perfil do cozinheiro
      const { error: updateError } = await supabase
        .from("cozinheiros")
        .update(cozinheiroInfo)
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);

      // 2. Se houver novas fotos, registra a face no CompreFace
      if (avatar_urls && avatar_urls.length > 0) {
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
      // 1. Deleta o cozinheiro (o CASCADE DELETE deve limpar as referências em itens_pedido)
      const { error } = await supabase.from("cozinheiros").delete().eq("id", cozinheiroId);
      if (error) throw new Error(error.message);
      
      // 2. Remove o subject do CompreFace (opcional, mas recomendado para limpeza)
      // NOTA: Esta funcionalidade não está implementada no CompreFace Edge Function, 
      // mas o sistema continuará funcionando sem ela.
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

  const filteredCozinheiros = cozinheiros?.filter(c => 
    c.nome.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  ) || [];

  if (isLoading || isLoadingSuperadminId) {
    return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-12" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Cozinheiros</h1>
          <p className="text-muted-foreground mt-1">Cadastre os membros da equipe de cozinha para reconhecimento facial.</p>
        </div>
        <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cozinheiro..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      {isError ? <p className="text-red-500">Erro ao carregar cozinheiros.</p> : filteredCozinheiros.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCozinheiros.map((cozinheiro) => (
            <CozinheiroCard
              key={cozinheiro.id}
              cozinheiro={cozinheiro}
              onEdit={() => handleFormOpen(cozinheiro)}
              onDelete={() => setCozinheiroToDelete(cozinheiro)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-card rounded-lg">
          <p className="text-muted-foreground">{debouncedSearchTerm ? `Nenhum cozinheiro encontrado para "${debouncedSearchTerm}".` : "Nenhum cozinheiro cadastrado ainda."}</p>
          {!debouncedSearchTerm && <p className="text-muted-foreground">Clique em "Adicionar Cozinheiro" para começar.</p>}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCozinheiro ? "Editar Cozinheiro" : "Adicionar Novo Cozinheiro"}</DialogTitle>
            <DialogDescription>
              Adicione fotos para o reconhecimento facial.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <CozinheiroForm 
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
                Tem certeza que deseja excluir o cozinheiro {cozinheiroToDelete.nome}? Esta ação não pode ser desfeita.
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