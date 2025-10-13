import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile, UserSettings } from "@/types/supabase";
import { ProfileForm } from "@/components/configuracoes/ProfileForm";
import { WebhookForm } from "@/components/configuracoes/WebhookForm";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

async function fetchUserData(): Promise<{ profile: Profile | null; settings: UserSettings | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profile: null, settings: null };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    throw new Error(profileError.message);
  }

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("id", user.id)
    .single();

  if (settingsError && settingsError.code !== 'PGRST116') {
    throw new Error(settingsError.message);
  }

  return { profile, settings };
}

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["userData"],
    queryFn: fetchUserData,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedProfile: Partial<Profile>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("profiles").update(updatedProfile).eq("id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userData"] });
      showSuccess("Perfil atualizado com sucesso!");
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<UserSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("user_settings").update(updatedSettings).eq("id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userData"] });
      showSuccess("Configurações salvas com sucesso!");
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-gray-600 mt-2">
          Gerencie as informações da sua conta e integrações.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Atualize seu nome e sobrenome.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : isError ? (
              <p className="text-red-500">Erro ao carregar o perfil.</p>
            ) : (
              <ProfileForm
                onSubmit={(values) => updateProfileMutation.mutate(values)}
                isSubmitting={updateProfileMutation.isPending}
                defaultValues={data?.profile || undefined}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
            <CardDescription>Configure seus webhooks para automações.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : isError ? (
              <p className="text-red-500">Erro ao carregar as configurações.</p>
            ) : (
              <WebhookForm
                onSubmit={(values) => updateSettingsMutation.mutate(values)}
                isSubmitting={updateSettingsMutation.isPending}
                defaultValues={data?.settings || undefined}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}