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
import { Skeleton } from "@/components/ui/skeleton";
import { useSuperadminId } from "@/hooks/useSuperadminId";
import { usePageActions } from "@/contexts/PageActionsContext";

async function fetchCozinheiros(): Promise<Cozinheiro[]> {
  const { data, error } = await supabase
    .from("cozinheiros")
    .select("*")
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);
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

  const { data: cozinheiros, isLoading, isError } = useQuery({
    queryKey: ["cozinheiros"],
    queryFn: fetchCozinheiros,
  });

  const handleFormOpen = (cozinheiro: Cozinheiro | null = null) => {
    setEditingCozinheiro(cozinheiro);
    setIsFormOpen(true);
  };

  useEffect(() => {
    const pageActions = (
      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cozinheiro..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Cozinheiro</Button>
      </div>
    );
    setPageActions(pageActions);

    return () => setPageActions(null);
  }, [setPageActions, searchTerm]);

  const handleFormClose = () => {
    setEditingCozinheiro(null);
    setIsFormOpen(false);
  };

  const addCozinheiroMutation = useMutation({
    mutationFn: async (newCook: any) => {
      if (!superadminId) throw new Error("ID do Superadmin não encontrado.");
      
      const { avatar_urls, ...cookData } = newCook;
      
      if (!avatar_urls || avatar_urls.length === 0) {
        throw new Error("É necessário pelo menos uma foto para o reconhecimento.");
      }
      
      // 1. Insere o cozinheiro (associado ao Superadmin)
      const { data: newCozinheiro, error: insertError } = await supabase
        .from("cozinheiros")
        .insert([{ ...cookData, user_id: superadminId }])
        .select("id")
        .single();
        
      if (insertError) throw new Error(insertError.message);
      const newCookId = newCozinheiro.id;

      // 2. Registra a face no CompreFace
      try {
        const { error: faceError } = await supabase.functions.invoke('add-cook-face-examples', {
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
      
      const originalCook = cozinheiros?.find(c => c.id === id);
      const originalAvatarUrl = originalCook?.avatar_url;

      // 1. Atualiza os dados do cozinheiro
      const { error: cookError } = await supabase.from("cozinheiros").update({ ...cookInfo, avatar_url: avatar_urls[0] || null }).eq("id", id);
      if (cookError) throw new Error(cookError.message);

      // 2. Se houver novas fotos, registra no CompreFace
      const newAvatarUrls = avatar_urls.filter((url: string) => url !== originalAvatarUrl);

      if (newAvatarUrls && newAvatarUrls.length > 0) {
        const { error: faceError } = await supabase.functions.invoke('add-cook-face-examples', {
          body: { subject: id, image_urls: newAvatarUrls }
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
      // NOTA: A remoção do sujeito no CompreFace deve ser feita manualmente ou via outro endpoint,
      // mas para simplificar, focamos apenas na remoção do registro no banco.
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
  
  const filteredCozinheiros = cozinheiros?.filter(c => 
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading || isLoadingSuperadminId) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError) {
    return <p className="text-destructive">Erro ao carregar cozinheiros.</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Cozinheiros</h1>
        <p className="text-muted-foreground mt-1">Cadastre e gerencie a equipe da cozinha para o controle de preparo.</p>
      </div>

      {filteredCozinheiros.length > 0 ? (
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
          <p className="text-muted-foreground">{searchTerm ? `Nenhum cozinheiro encontrado para "${searchTerm}".` : "Nenhum cozinheiro cadastrado ainda."}</p>
          {!searchTerm && <p className="text-muted-foreground">Clique em "Adicionar Cozinheiro" para começar.</p>}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCozinheiro ? "Editar Cozinheiro" : "Adicionar Novo Cozinheiro"}</DialogTitle>
            <DialogDescription>
              Adicione fotos para o reconhecimento facial na cozinha.
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
                Tem certeza que deseja excluir {cozinheiroToDelete.nome}? Esta ação não pode ser desfeita e removerá o cozinheiro do sistema de reconhecimento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCozinheiroToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteCozinheiroMutation.mutate(cozinheiroToDelete.id)} disabled={deleteCozinheiroMutation.isPending}>
                {deleteCozinheiroMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirmar Exclusão"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}