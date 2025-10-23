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

type CozinheiroProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

async function fetchCozinheiros(): Promise<CozinheiroProfile[]> {
  // Busca todos os perfis com a role 'cozinha'
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name');
  
  if (profilesError) throw profilesError;

  const cozinheiroIds = profiles.filter(p => p.role === 'cozinha').map(p => p.id);
  
  // Como não podemos usar o RLS para buscar emails de auth.users,
  // usaremos a função get-all-users (que é restrita ao Superadmin)
  // ou, se o usuário logado for Admin/Gerente, faremos uma busca mais limitada.
  
  // Para simplificar e garantir que Admin/Gerente possam ver, vamos buscar todos os usuários
  // e filtrar no frontend, confiando que o RLS permite a leitura de perfis.
  
  const { data: allUsersData, error: allUsersError } = await supabase.functions.invoke('get-all-users');
  
  if (allUsersError) {
    // Se falhar (ex: não é Superadmin), tentamos buscar apenas os perfis
    console.warn("Falha ao buscar todos os usuários via Edge Function. Retornando apenas perfis.");
    return profiles.filter(p => p.role === 'cozinha').map(p => ({
        id: p.id,
        email: 'N/A (Acesso Restrito)',
        first_name: p.first_name,
        last_name: p.last_name,
    }));
  }
  
  const allUsers = allUsersData.users as any[];
  
  return allUsers
    .filter(u => u.role === 'cozinha')
    .map(u => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
    }));
}

export function CozinheiroManager() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCozinheiro, setEditingCozinheiro] = useState<CozinheiroProfile | null>(null);
  const [cozinheiroToDelete, setCozinheiroToDelete] = useState<CozinheiroProfile | null>(null);

  const { data: cozinheiros, isLoading, isError } = useQuery({
    queryKey: ["cozinheiros"],
    queryFn: fetchCozinheiros,
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
      const { email, password, first_name, last_name, avatar_urls } = values;
      
      // 1. Cria o usuário auth via Edge Function (role 'cozinha' será definida no perfil)
      const { data, error } = await supabase.functions.invoke('manage-auth-user', {
        body: { action: 'CREATE', email, password, first_name, last_name },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha ao criar usuário auth.");
      
      const newUserId = data.userId;

      // 2. Atualiza o perfil com a função 'cozinha' (o trigger cria com 'garcom' por padrão)
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role: 'cozinha' })
        .eq("id", newUserId);
      if (roleError) throw roleError;
      
      // 3. Registra a face no CompreFace (usando o ID do usuário como subject)
      const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
        body: { subject: newUserId, image_urls: avatar_urls }
      });
      if (faceError) {
        // Se falhar o registro facial, remove o usuário para evitar inconsistência
        await supabase.functions.invoke('manage-auth-user', { body: { action: 'DELETE', user_id: newUserId } });
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
      const { id, first_name, last_name, password, avatar_urls } = values;
      
      // 1. Atualiza o perfil (nome)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ first_name, last_name })
        .eq("id", id);
      if (profileError) throw profileError;
      
      // 2. Atualiza a senha se fornecida
      if (password) {
        const { data, error } = await supabase.functions.invoke('manage-auth-user', {
          body: { action: 'UPDATE_PASSWORD', user_id: id, password },
        });
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "Falha ao atualizar senha.");
      }
      
      // 3. Registra novas faces (substitui as antigas no CompreFace)
      if (avatar_urls && avatar_urls.length > 0) {
        const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
          body: { subject: id, image_urls: avatar_urls }
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
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-auth-user', {
        body: { action: 'DELETE', user_id: userId },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha ao deletar usuário.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cozinheiros"] });
      showSuccess("Cozinheiro removido com sucesso!");
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
                    {cozinheiro.first_name} {cozinheiro.last_name}
                  </TableCell>
                  <TableCell>{cozinheiro.email}</TableCell>
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
                Tem certeza que deseja remover o cozinheiro {cozinheiroToDelete.first_name || cozinheiroToDelete.email}? Esta ação é irreversível e removerá o acesso dele ao sistema.
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