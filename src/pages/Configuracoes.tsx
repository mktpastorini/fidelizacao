import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile, UserSettings, MessageTemplate } from "@/types/supabase";
import { ProfileForm } from "@/components/configuracoes/ProfileForm";
import { WebhookForm } from "@/components/configuracoes/WebhookForm";
import { TemplateSettingsForm } from "@/components/configuracoes/TemplateSettingsForm";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type UserData = {
  profile: Profile | null;
  settings: UserSettings | null;
  templates: MessageTemplate[];
};

async function fetchUserData(): Promise<UserData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profile: null, settings: null, templates: [] };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (profileError && profileError.code !== 'PGRST116') throw new Error(profileError.message);

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("id", user.id)
    .single();
  if (settingsError && settingsError.code !== 'PGRST116') throw new Error(settingsError.message);

  const { data: templates, error: templatesError } = await supabase
    .from("message_templates")
    .select("*");
  if (templatesError) throw new Error(templatesError.message);

  return { profile, settings, templates: templates || [] };
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
    onError: (error: Error) => showError(error.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<UserSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      const settingsToUpsert = {
        id: user.id,
        webhook_url: updatedSettings.webhook_url !== undefined ? updatedSettings.webhook_url : data?.settings?.webhook_url,
        chegada_template_id: updatedSettings.chegada_template_id !== undefined ? updatedSettings.chegada_template_id : data?.settings?.chegada_template_id,
        pagamento_template_id: updatedSettings.pagamento_template_id !== undefined ? updatedSettings.pagamento_template_id : data?.settings?.pagamento_template_id,
      };

      const { error } = await supabase.from("user_settings").upsert(settingsToUpsert);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userData"] });
      showSuccess("Configurações salvas com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const testWebhookMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-webhook');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      showSuccess("Webhook testado com sucesso! Verifique seu serviço para a mensagem de teste.");
    },
    onError: (error: Error) => {
      showError(`Teste falhou: ${error.message}`);
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>Atualize seu nome e sobrenome.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar o perfil.</p> : (
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
            <CardDescription>Configure seu webhook para automações de WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar as configurações.</p> : (
              <WebhookForm
                onSubmit={(values) => updateSettingsMutation.mutate(values)}
                isSubmitting={updateSettingsMutation.isPending}
                defaultValues={data?.settings || undefined}
                onTest={() => testWebhookMutation.mutate()}
                isTesting={testWebhookMutation.isPending}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automação de Mensagens</CardTitle>
            <CardDescription>Escolha os templates para cada evento automático.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-24 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar os templates.</p> : (
              <TemplateSettingsForm
                onSubmit={(values) => updateSettingsMutation.mutate(values)}
                isSubmitting={updateSettingsMutation.isPending}
                defaultValues={data?.settings || undefined}
                templates={data?.templates || []}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}