import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { showError, showSuccess } from "@/utils/toast";
import { useSettings } from "@/contexts/SettingsContext";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, User, Trash2, Loader2, PlusCircle, Edit, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { UserRole } from "@/types/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserForm } from "@/components/usuarios/UserForm";
import { PasswordResetForm } from "@/components/usuarios/PasswordResetForm"; // Importado

type UserProfile = {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
};

const ROLES: { value: UserRole, label: string }[] = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'balcao', label: 'Balcão' },
  { value: 'garcom', label: 'Garçom' },
  { value: 'cozinha', label: 'Cozinha' },
];

async function fetchAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase.functions.invoke('get-all-users');
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || "Falha ao buscar usuários.");
  
  return data.users.map((u: any) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    first_name: u.first_name,
    last_name: u.last_name,
  }));
}

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const { userRole, isLoading: isLoadingSettings } = useSettings();
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToResetPassword, setUserToResetPassword] = useState<UserProfile | null>(null); // Novo estado

  const { data: users, isLoading: isLoadingUsers, isError } = useQuery({
    queryKey: ["allUsers"],
    queryFn: fetchAllUsers,
    enabled: userRole === 'superadmin',
    refetchInterval: 60000, // Atualiza a cada minuto
  });

  const handleFormOpen = (user: UserProfile | null = null) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingUser(null);
    setIsFormOpen(false);
  };

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      showSuccess("Função do usuário atualizada!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (values: { id: string; first_name: string; last_name: string; role: UserRole }) => {
      const { id, first_name, last_name, role } = values;
      
      // 1. Atualiza o perfil (nome e função)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ first_name, last_name, role })
        .eq("id", id);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      showSuccess("Perfil do usuário atualizado!");
      handleFormClose();
    },
    onError: (error: Error) => showError(error.message),
  });

  const createUserMutation = useMutation({
    mutationFn: async (values: { email: string; password: string; first_name: string; last_name: string; role: UserRole }) => {
      const { email, password, first_name, last_name, role } = values;
      
      // 1. Cria o usuário auth via Edge Function
      const { data, error } = await supabase.functions.invoke('manage-auth-user', {
        body: { action: 'CREATE', email, password, first_name, last_name },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha ao criar usuário auth.");
      
      const newUserId = data.userId;

      // 2. Atualiza o perfil com a função correta (o trigger cria o perfil com 'garcom' por padrão)
      // Nota: Esta parte requer o cliente admin, que não está disponível no frontend.
      // A Edge Function manage-auth-user não retorna o Service Role Key.
      // Para contornar, vamos confiar que o trigger handle_new_user cria o perfil,
      // e o Superadmin pode ajustar a função manualmente na tabela se necessário,
      // ou criamos uma nova Edge Function para atualizar o perfil (mas vamos manter simples por enquanto).
      
      // Como a função manage-auth-user não atualiza o perfil, faremos a atualização da role aqui
      // usando o cliente Supabase normal, que deve funcionar se o RLS permitir que o Superadmin
      // atualize perfis (o que está configurado).
      const { error: roleError } = await supabase
        .from("profiles")
        .update({ role: role })
        .eq("id", newUserId);
      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      showSuccess("Novo usuário criado com sucesso!");
      handleFormClose();
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-auth-user', {
        body: { action: 'DELETE', user_id: userId },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha ao deletar usuário.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      showSuccess("Usuário removido com sucesso!");
      setUserToDelete(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-auth-user', {
        body: { action: 'UPDATE_PASSWORD', user_id: userId, password },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha ao redefinir senha.");
    },
    onSuccess: () => {
      showSuccess("Senha redefinida com sucesso!");
      setUserToResetPassword(null);
    },
    onError: (error: Error) => showError(error.message),
  });

  if (isLoadingSettings || isLoadingUsers) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (userRole !== 'superadmin') {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso Negado</AlertTitle>
        <AlertDescription>
          Sua função atual ({userRole}) não tem permissão para acessar esta página.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground mt-1">Defina as funções e gerencie o acesso dos colaboradores.</p>
        </div>
        <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Usuário</Button>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        {isError ? (
          <p className="text-destructive">Erro ao carregar usuários. Verifique as configurações do Edge Function.</p>
        ) : users && users.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium flex items-center">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, newRole: newRole as UserRole })}
                      disabled={updateRoleMutation.isPending || user.id === supabase.auth.getUser().id} // Não permite mudar a própria função
                    >
                      <SelectTrigger className={cn("w-[180px]", user.role === 'superadmin' && 'bg-primary/10')}>
                        <SelectValue placeholder="Selecione a função" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="mr-2"
                      onClick={() => setUserToResetPassword(user)}
                      disabled={resetPasswordMutation.isPending}
                      title="Redefinir Senha"
                    >
                      <Lock className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="mr-2"
                      onClick={() => handleFormOpen(user)}
                      disabled={updateProfileMutation.isPending}
                      title="Editar Perfil"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      onClick={() => setUserToDelete(user)}
                      disabled={user.id === supabase.auth.getUser().id || deleteUserMutation.isPending} // Não permite deletar a si mesmo
                      title="Excluir Usuário"
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
            <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
          </div>
        )}
      </div>
      
      {/* Diálogo de Confirmação de Exclusão */}
      {userToDelete && (
        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão de Usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o usuário {userToDelete.first_name || userToDelete.email}? Esta ação é irreversível e removerá o acesso dele ao sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deleteUserMutation.mutate(userToDelete.id)}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Confirmar Exclusão"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Diálogo de Adição/Edição de Usuário */}
      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Adicionar Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <UserForm
            onSubmit={editingUser ? updateProfileMutation.mutate : createUserMutation.mutate}
            isSubmitting={updateProfileMutation.isPending || createUserMutation.isPending}
            defaultValues={editingUser || undefined}
            isEditing={!!editingUser}
          />
        </DialogContent>
      </Dialog>

      {/* Diálogo de Redefinição de Senha */}
      <Dialog open={!!userToResetPassword} onOpenChange={() => setUserToResetPassword(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Redefinir Senha para {userToResetPassword?.first_name || userToResetPassword?.email}</DialogTitle>
          </DialogHeader>
          <PasswordResetForm
            onSubmit={(values) => resetPasswordMutation.mutate({ userId: userToResetPassword!.id, password: values.password })}
            isSubmitting={resetPasswordMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}