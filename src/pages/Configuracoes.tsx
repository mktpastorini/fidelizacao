import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile, UserSettings, MessageTemplate, Produto } from "@/types/supabase";
import { ProfileForm } from "@/components/configuracoes/ProfileForm";
import { WebhookForm } from "@/components/configuracoes/WebhookForm";
import { TemplateSettingsForm } from "@/components/configuracoes/TemplateSettingsForm";
import { ApiDocumentation } from "@/components/configuracoes/ApiDocumentation";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings } from "@/contexts/SettingsContext";

type UserData = {
  profile: Profile | null;
  templates: MessageTemplate[];
  produtos: Produto[];
};

async function fetchPageData(): Promise<UserData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { profile: null, templates: [], produtos: [] };

  const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profileError && profileError.code !== 'PGRST116') throw new Error(`Erro ao buscar perfil: ${profileError.message}`);
  
  const { data: templates, error: templatesError } = await supabase.from("message_templates").select("*");
  if (templatesError) throw new Error(`Erro ao buscar templates: ${templatesError.message}`);

  const { data: produtos, error: produtosError } = await supabase.from("produtos").select("*").order("nome");
  if (produtosError) throw new Error(`Erro ao buscar produtos: ${produtosError.message}`);

  return { profile: profiles, templates: templates || [], produtos: produtos || [] };
}

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const { settings, refetch: refetchSettings, isLoading: isLoadingSettings } = useSettings();

  const { data, isLoading: isLoadingPage, isError } = useQuery({
    queryKey: ["configPageData"],
    queryFn: fetchPageData,
  });

  const isLoading = isLoadingSettings || isLoadingPage;

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedProfile: Partial<Profile>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("profiles").update(updatedProfile).eq("id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configPageData"] });
      showSuccess("Perfil atualizado com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<UserSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      const settingsToUpsert = { id: user.id, ...updatedSettings };

      const { error } = await supabase.from("user_settings").upsert(settingsToUpsert);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      refetchSettings();
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

  const regenerateApiKeyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regenerate_api_key');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      refetchSettings();
      showSuccess("Nova chave de API gerada com sucesso!");
    },
    onError: (error: Error) => {
      showError(`Falha ao gerar chave: ${error.message}`);
    },
  });

  const handleCopy = (text: string | null | undefined) => {
    if (text) {
      navigator.clipboard.writeText(text);
      showSuccess("Chave de API copiada!");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-gray-600 mt-2">
          Gerencie as informações da sua conta, integrações e automações.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="perfil">Perfil & Integrações</TabsTrigger>
          <TabsTrigger value="automacao">Automação</TabsTrigger>
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
          <TabsTrigger value="api">Documentação API</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
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
                <CardTitle>Chave de API</CardTitle>
                <CardDescription>Use esta chave para autenticar requisições à API do Fidelize.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-20 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input readOnly value={settings?.api_key || "Nenhuma chave gerada"} />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(settings?.api_key)}><Copy className="w-4 h-4" /></Button>
                    </div>
                    <Button variant="secondary" onClick={() => regenerateApiKeyMutation.mutate()} disabled={regenerateApiKeyMutation.isPending}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {regenerateApiKeyMutation.isPending ? "Gerando..." : "Gerar Nova Chave"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Integrações</CardTitle>
                <CardDescription>Configure seu webhook para automações de WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-24 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar as configurações.</p> : (
                  <WebhookForm
                    onSubmit={(values) => updateSettingsMutation.mutate(values)}
                    isSubmitting={updateSettingsMutation.isPending}
                    defaultValues={settings || undefined}
                    onTest={() => testWebhookMutation.mutate()}
                    isTesting={testWebhookMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Inteligência Artificial</CardTitle>
                <CardDescription>Selecione o provedor para o reconhecimento facial.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-20 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-provider">Provedor de Reconhecimento Facial</Label>
                      <Select
                        defaultValue={settings?.ai_provider || 'simulacao'}
                        onValueChange={(value) => updateSettingsMutation.mutate({ ai_provider: value })}
                      >
                        <SelectTrigger id="ai-provider">
                          <SelectValue placeholder="Selecione um provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simulacao">Simulação (Padrão)</SelectItem>
                          <SelectItem value="face-api.js">Reconhecimento Facial (Beta)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        O modo de simulação é útil para testes. O modo de reconhecimento facial utiliza um modelo de IA para identificar clientes reais.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automacao" className="mt-6">
          <div className="space-y-6">
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
                    defaultValues={settings || undefined}
                    templates={data?.templates || []}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Automação de Pedidos</CardTitle>
                <CardDescription>Configure um item para ser adicionado automaticamente quando um cliente senta à mesa.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-32 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="auto-add-item"
                        checked={settings?.auto_add_item_enabled}
                        onCheckedChange={(checked) => updateSettingsMutation.mutate({ auto_add_item_enabled: checked })}
                      />
                      <Label htmlFor="auto-add-item">Habilitar item de entrada automático</Label>
                    </div>
                    {settings?.auto_add_item_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="default-product">Produto Padrão</Label>
                        <Select
                          value={settings?.default_produto_id || ""}
                          onValueChange={(value) => updateSettingsMutation.mutate({ default_produto_id: value })}
                        >
                          <SelectTrigger id="default-product">
                            <SelectValue placeholder="Selecione o produto padrão" />
                          </SelectTrigger>
                          <SelectContent>
                            {data?.produtos.map(produto => (
                              <SelectItem key={produto.id} value={produto.id}>{produto.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fechamento do Dia</CardTitle>
                <CardDescription>Configure o relatório diário e o fechamento automático.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="report-phone">Nº de WhatsApp para Relatório</Label>
                      <Input
                        id="report-phone"
                        placeholder="(99) 99999-9999"
                        defaultValue={settings?.daily_report_phone_number || ""}
                        onBlur={(e) => updateSettingsMutation.mutate({ daily_report_phone_number: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="auto-close"
                        checked={settings?.auto_close_enabled}
                        onCheckedChange={(checked) => updateSettingsMutation.mutate({ auto_close_enabled: checked })}
                      />
                      <Label htmlFor="auto-close">Habilitar fechamento automático</Label>
                    </div>
                    {settings?.auto_close_enabled && (
                      <div>
                        <Label htmlFor="auto-close-time">Horário do Fechamento</Label>
                        <Input
                          id="auto-close-time"
                          type="time"
                          defaultValue={settings?.auto_close_time || "23:00"}
                          onBlur={(e) => updateSettingsMutation.mutate({ auto_close_time: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aparencia" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Estilo do Menu</CardTitle>
              <CardDescription>
                Escolha como você prefere navegar pelo sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-24 w-full" /> : (
                <RadioGroup
                  value={settings?.menu_style || 'sidebar'}
                  onValueChange={(value) => updateSettingsMutation.mutate({ menu_style: value })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sidebar" id="sidebar" />
                    <Label htmlFor="sidebar">Barra Lateral (Padrão)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dock" id="dock" />
                    <Label htmlFor="dock">Dock Inferior</Label>
                  </div>
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <ApiDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
}