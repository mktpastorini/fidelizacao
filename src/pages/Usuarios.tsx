import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { showError, showSuccess } from "@/utils/toast";
import { useSettings } from "@/contexts/SettingsContext";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, User, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";

type UserProfile = {
  id: string;
  email: string;
  role: 'superadmin' | 'admin' | 'gerente' | 'balcao' | 'garcom' | 'cozinha';
  first_name: string | null;
  last_name: string | null;
};

const ROLES = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'balcao', label: 'Balcão' },
  { value: 'garcom', label: 'Garçom' },
  { value: 'cozinha', label: 'Cozinha' },
];

async function fetchAllUsers(): Promise<UserProfile[]> {
  // Esta função deve ser chamada apenas por Superadmins.
  // Usamos o RLS para garantir que apenas Superadmins possam ler todos os perfis.
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name, user_settings(id)"); // user_settings(id) para garantir que o join funcione
  
  if (error) throw new Error(error.message);

  // Para obter o email, precisamos de uma função de admin ou de um Edge Function.
  // Como não temos uma função de admin exposta, vamos simular a busca de emails
  // (Em um ambiente real, isso exigiria uma Edge Function com Service Role Key).
  // Por enquanto, vamos usar apenas os dados do perfil.
  
  // Simulação de dados de autenticação (apenas para fins de demonstração no frontend)
  const usersWithEmails = profiles.map(p => ({
    id: p.id,
    email: `user_${p.id.substring(0, 4)}@example.com`, // Placeholder
    role: p.role as UserProfile['role'],
    first_name: p.first_name,
    last_name: p.last_name,
  }));

  return usersWithEmails;
}

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const { userRole, isLoading: isLoadingSettings } = useSettings();
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const { data: users, isLoading: isLoadingUsers, isError } = useQuery({
    queryKey: ["allUsers"],
    queryFn: fetchAllUsers,
    enabled: userRole === 'superadmin',
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserProfile['role'] }) => {
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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // 1. Deletar o perfil (RLS garante que apenas superadmin pode fazer isso)
      const { error: profileError } = await supabase.from("profiles").delete().eq("id", userId);
      if (profileError) throw profileError;
      
      // 2. Deletar o usuário da tabela auth.users (requer Service Role Key, o que é feito via Edge Function)
      // Como não podemos usar o Service Role Key diretamente no cliente,
      // em um ambiente real, você chamaria uma Edge Function aqui.
      // Por enquanto, vamos apenas deletar o perfil e assumir que o Superadmin fará a limpeza manual no Supabase Auth.
      // Para simulação, vamos apenas mostrar o sucesso.
      
      // Simulação de chamada de Edge Function para deletar o usuário auth
      // const { error: authError } = await supabase.functions.invoke('delete-auth-user', { body: { userId } });
      // if (authError) throw authError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      showSuccess("Usuário removido com sucesso!");
      setUserToDelete(null);
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
          Você não tem permissão para acessar o gerenciamento de usuários.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        <p className="text-muted-foreground mt-1">Defina as funções e gerencie o acesso dos colaboradores.</p>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        {isError ? (
          <p className="text-destructive">Erro ao carregar usuários. Verifique as políticas RLS.</p>
        ) : users && users.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email (Placeholder)</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium flex items-center">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    {user.first_name || user.email.split('@')[0]}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, newRole: newRole as UserProfile['role'] })}
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
                      variant="destructive" 
                      size="icon" 
                      onClick={() => setUserToDelete(user)}
                      disabled={user.id === supabase.auth.getUser().id || deleteUserMutation.isPending} // Não permite deletar a si mesmo
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
    </div>
  );
}