import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { showError, showSuccess } from "@/utils/toast";
import { PlusCircle, Edit, Trash2, Loader2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { CozinheiroForm } from "./CozinheiroForm";
import { Cozinheiro } from "@/types/supabase";
import { useSuperadminId } from "@/hooks/useSuperadminId";

type CozinheiroProfile = Cozinheiro;

async function fetchCozinheiros(superadminId: string | null): Promise<CozinheiroProfile[]> {
  if (!superadminId) return [];
  
  const { data, error } = await supabase
    .from('cozinheiros')
    .select('*')
    .eq('user_id', superadminId)
    .order('nome');
  
  if (error) throw error;
  return data || [];
}

export function CozinheiroManager() {
  const queryClient = useQueryClient();
  const { superadminId } = useSuperadminId();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCozinheiro, setEditingCozinheiro] = useState<CozinheiroProfile | null>(null);
  const [cozinheiroToDelete, setCozinheiroToDelete] = useState<CozinheiroProfile | null>(null);

  const { data: cozinheiros, isLoading, isError } = useQuery({
    queryKey: ["cozinheiros"],
    queryFn: () => fetchCozinheiros(superadminId),
    enabled: !!superadminId,
    refetchInterval: 30000,
  });

  const handleFormOpen = (cozinheiro: CozinheiroProfile | null = null) => {
    setEditingCozinheiro(cozinheiro);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingCozinheiro(null);
    setIsFormOpen(false);
  };

  const createCozinheiroMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!superadminId) throw new Error("ID do Superadmin não encontrado.");
      const { nome, email, avatar_urls, avatar_url } = values;
      
      // 1. Cria o cozinheiro na tabela 'cozinheiros'
      const { data: newCook, error: insertError } = await supabase
        .from("cozinheiros")
        .insert({ nome, email, avatar_url, user_id: superadminId })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      const newCookId = newCook.id;
      
      // 2. Registra a face no CompreFace (usando o ID do cozinheiro com prefixo 'cook_')
      const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
        body: { subject: newCookId, image_urls: avatar_urls, is_cook: true }
      });
      if (faceError) {
        // Se falhar o registro facial, remove o cozinheiro para evitar inconsistência
        await supabase.from("cozinheiros").delete().eq("id", newCookId);
        throw new Error(`O cadastro falhou durante o registro facial. A operação foi desfeita. Erro original: ${faceError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cozinheiros"] });
      showSuccess("Cozinheiro cadastrado com sucesso!");
      handleFormClose();
    },
    onError: (error: Error) => showError(error.message),
  });

  const updateCozinheiroMutation = useMutation({
    mutationFn: async (values: any) => {
      const { id, nome, email, avatar_urls, avatar_url } = values;
      
      // 1. Atualiza o perfil
      const { error: profileError } = await supabase
        .from("cozinheiros")
        .update({ nome, email, avatar_url })
        .eq("id", id);
      if (profileError) throw profileError;
      
      // 2. Registra novas faces (substitui as antigas no CompreFace)
      if (avatar_urls && avatar_urls.length > 0) {
        const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
          body: { subject: id, image_urls: avatar_urls, is_cook: true }
        });
        if (faceError) throw new Error(`Perfil atualizado, mas falha ao registrar novos rostos: ${faceError.message}`);
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
    mutationFn: async (cookId: string) => {
      // NOTA: O CompreFace não tem um endpoint DELETE BY SUBJECT.
      // A remoção de faces deve ser feita manualmente no CompreFace, mas removemos o registro local.
      const { error } = await supabase.from("cozinheiros").delete().eq("id", cookId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cozinheiros"] });
      showSuccess("Cozinheiro removido com sucesso! (Atenção: As faces devem ser removidas manualmente do CompreFace se necessário.)");
      setCozinheiroToDelete(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Cozinheiro</Button>
      </div>
      
      <div className="bg-card p-6 rounded-lg border">
        <h2 className="text-xl font-bold mb-4">Cozinheiros Cadastrados</h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <p className="text-destructive">Erro ao carregar cozinheiros.</p>
        ) : cozinheiros && cozinheiros.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cozinheiros.map((cozinheiro) => (
                <TableRow key={cozinheiro.id}>
                  <TableCell className="font-medium flex items-center">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    {cozinheiro.nome}
                  </TableCell>
                  <TableCell>{cozinheiro.email || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="mr-2"
                      onClick={() => handleFormOpen(cozinheiro)}
                      disabled={updateCozinheiroMutation.isPending}
                      title="Editar Perfil"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      onClick={() => setCozinheiroToDelete(cozinheiro)}
                      disabled={deleteCozinheiroMutation.isPending}
                      title="Excluir Cozinheiro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum cozinheiro cadastrado.</p>
          </div>
        )}
      </div>

      {/* Diálogo de Adição/Edição */}
      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCozinheiro ? "Editar Cozinheiro" : "Adicionar Novo Cozinheiro"}</DialogTitle>
          </DialogHeader>
          <CozinheiroForm
            onSubmit={editingCozinheiro ? updateCozinheiroMutation.mutate : createCozinheiroMutation.mutate}
            isSubmitting={createCozinheiroMutation.isPending || updateCozinheiroMutation.isPending}
            defaultValues={editingCozinheiro || undefined}
            isEditing={!!editingCozinheiro}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      {cozinheiroToDelete && (
        <AlertDialog open={!!cozinheiroToDelete} onOpenChange={() => setCozinheiroToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão de Cozinheiro</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o cozinheiro {cozinheiroToDelete.nome}? Esta ação é irreversível e removerá o registro local.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deleteCozinheiroMutation.mutate(cozinheiroToDelete.id)}
                disabled={deleteCozinheiroMutation.isPending}
              >
                {deleteCozinheiroMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirmar Exclusão"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}