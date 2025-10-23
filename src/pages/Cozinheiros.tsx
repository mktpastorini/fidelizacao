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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Trash2, Edit, User, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { CozinheiroForm } from "@/components/cozinheiros/CozinheiroForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

async function fetchCozinheiros(): Promise<Cozinheiro[]> {
  const { data, error } = await supabase.from("cozinheiros").select("*").order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

export default function CozinheirosPage() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCozinheiro, setEditingCozinheiro] = useState<Cozinheiro | null>(null);
  const [cozinheiroToDelete, setCozinheiroToDelete] = useState<Cozinheiro | null>(null);

  const { data: cozinheiros, isLoading, isError } = useQuery({
    queryKey: ["cozinheiros"],
    queryFn: fetchCozinheiros,
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
    mutationFn: async (newCozinheiro: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { avatar_urls, ...cozinheiroData } = newCozinheiro;
      
      // 1. Insere o cozinheiro no banco
      const { data: insertedCook, error: insertError } = await supabase
        .from("cozinheiros")
        .insert([{ nome: cozinheiroData.nome, avatar_url: cozinheiroData.avatar_url, user_id: user.id }])
        .select('id')
        .single();
      if (insertError) throw new Error(insertError.message);
      const newCookId = insertedCook.id;

      // 2. Registra as faces no CompreFace
      const { error: faceError } = await supabase.functions.invoke('add-cook-face-examples', {
        body: { subject: newCookId, image_urls: avatar_urls }
      });
      if (faceError) {
        // Se falhar o registro facial, remove o cozinheiro para evitar inconsistência
        await supabase.from("cozinheiros").delete().eq("id", newCookId);
        throw new Error(`O cadastro do cozinheiro falhou durante o registro facial. A operação foi desfeita. Erro original: ${faceError.message}`);
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
      const { id, avatar_urls, ...cookInfo } = updatedCozinheiro;
      
      // 1. Atualiza o perfil do cozinheiro
      const { error: updateError } = await supabase
        .from("cozinheiros")
        .update({ nome: cookInfo.nome, avatar_url: cookInfo.avatar_url })
        .eq("id", id);
      if (updateError) throw new Error(updateError.message);

      // 2. Se houver novas fotos, registra no CompreFace (substituindo as antigas)
      if (avatar_urls && avatar_urls.length > 0) {
        // NOTA: O CompreFace sobrescreve o subject se ele já existir.
        const { error: faceError } = await supabase.functions.invoke('add-cook-face-examples', {
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
      // 1. Deleta o cozinheiro (o CASCADE DELETE deve remover as referências em itens_pedido)
      const { error } = await supabase.from("cozinheiros").delete().eq("id", cozinheiroId);
      if (error) throw new Error(error.message);
      
      // 2. Remove o subject do CompreFace (opcional, mas recomendado para limpeza)
      // NOTA: Não temos um endpoint de remoção de subject implementado, mas o CompreFace lida com sujeitos órfãos.
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

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Cozinheiros</h1>
          <p className="text-muted-foreground mt-1">Cadastre os cozinheiros para o reconhecimento facial na cozinha.</p>
        </div>
        <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Cozinheiro</Button>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        {isError ? (
          <p className="text-destructive">Erro ao carregar cozinheiros.</p>
        ) : cozinheiros && cozinheiros.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cozinheiros.map((cozinheiro) => (
                <TableRow key={cozinheiro.id}>
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={cozinheiro.avatar_url || undefined} />
                      <AvatarFallback><User /></AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{cozinheiro.nome}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="mr-2"
                      onClick={() => handleFormOpen(cozinheiro)}
                      title="Editar Cozinheiro"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      onClick={() => setCozinheiroToDelete(cozinheiro)}
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
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum cozinheiro cadastrado ainda.</p>
          </div>
        )}
      </div>
      
      {/* Diálogo de Adição/Edição de Cozinheiro */}
      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCozinheiro ? "Editar Cozinheiro" : "Adicionar Novo Cozinheiro"}</DialogTitle>
          </DialogHeader>
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <CozinheiroForm
              onSubmit={editingCozinheiro ? editCozinheiroMutation.mutate : addCozinheiroMutation.mutate}
              isSubmitting={addCozinheiroMutation.isPending || editCozinheiroMutation.isPending}
              defaultValues={editingCozinheiro || undefined}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      {cozinheiroToDelete && (
        <AlertDialog open={!!cozinheiroToDelete} onOpenChange={() => setCozinheiroToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão de Cozinheiro</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover {cozinheiroToDelete.nome}? Esta ação é irreversível e removerá o perfil facial dele do sistema.
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