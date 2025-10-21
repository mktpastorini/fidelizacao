import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserSettings, MessageTemplate, Produto } from "@/types/supabase";
import { WebhookForm } from "@/components/configuracoes/WebhookForm";
import { TemplateSettingsForm } from "@/components/configuracoes/TemplateSettingsForm";
import { ApiDocumentation } from "@/components/configuracoes/ApiDocumentation";
import { CameraSettings } from "@/components/configuracoes/CameraSettings";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Copy, RefreshCw, Send, Video, VideoOff, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings } from "@/contexts/SettingsContext";
import { RecognitionTester } from "@/components/configuracoes/RecognitionTester"; // Importando o testador

type UserData = {
  templates: MessageTemplate[];
  produtos: Produto[];
};

async function fetchPageData(): Promise<UserData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { templates: [], produtos: [] };

  const { data: templates, error: templatesError } = await supabase.from("message_templates").select("*");
  if (templatesError) throw new Error(`Erro ao buscar templates: ${templatesError.message}`);

  const { data: produtos, error: produtosError } = await supabase.from("produtos").select("*").order("nome");
  if (produtosError) throw new Error(`Erro ao buscar produtos: ${produtosError.message}`);

  return { templates: templates || [], produtos: produtos || [] };
}

// --- Componentes de Seção ---

function useSettingsMutator() {
  const { refetch: refetchSettings } = useSettings();
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
  return updateSettingsMutation;
}

function ProfileAndIntegrations({ settings, isLoading }: { settings: UserSettings | null, isLoading: boolean }) {
  const updateSettingsMutation = useSettingsMutator();

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
      updateSettingsMutation.reset(); // Força o refetch da chave
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Chave de API</CardTitle><CardDescription>Use esta chave para autenticar requisições à API do Fidelize.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-20 w-full" /> : (
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
      <Card>
        <CardHeader><CardTitle>Integração de Mensagens (Webhook)</CardTitle><CardDescription>Configure sua URL para automações de WhatsApp.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : (
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
    </div>
  );
}

function AutomationSettings({ settings, isLoading, templates, produtos }: { settings: UserSettings | null, isLoading: boolean, templates: MessageTemplate[], produtos: Produto[] }) {
  const updateSettingsMutation = useSettingsMutator();
  const sendBirthdayWishesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('trigger-birthday-wishes');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => showSuccess(data.message),
    onError: (error: Error) => showError(error.message),
  });

  const birthdayTemplates = templates.filter(t => t.tipo === 'aniversario' || t.tipo === 'geral') || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Templates de Eventos</CardTitle><CardDescription>Escolha os templates para cada evento automático (Chegada e Pós-Pagamento).</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : (
            <TemplateSettingsForm 
              onSubmit={(values) => updateSettingsMutation.mutate(values)} 
              isSubmitting={updateSettingsMutation.isPending} 
              defaultValues={settings || undefined} 
              templates={templates || []} 
            />
          )}
        </CardContent>
      </Card>
      
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Automação de Aniversários</CardTitle>
            <CardDescription>Configure o envio automático de mensagens de aniversário.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="birthday-template">Template de Aniversário</Label>
                  <Select value={settings?.aniversario_template_id || ""} onValueChange={(value) => updateSettingsMutation.mutate({ aniversario_template_id: value })}>
                    <SelectTrigger id="birthday-template">
                      <SelectValue placeholder="Selecione o template" />
                    </SelectTrigger>
                    <SelectContent>
                      {birthdayTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>{template.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="birthday-time">Horário de Envio</Label>
                  <Input 
                    id="birthday-time" 
                    type="time" 
                    defaultValue={settings?.aniversario_horario || "09:00"} 
                    onBlur={(e) => updateSettingsMutation.mutate({ aniversario_horario: e.target.value })} 
                  />
                </div>
                <Button 
                  onClick={() => sendBirthdayWishesMutation.mutate()} 
                  disabled={sendBirthdayWishesMutation.isPending}
                  variant="secondary"
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendBirthdayWishesMutation.isPending ? "Enviando..." : "Enviar para Aniversariantes de Hoje (Manual)"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Para envio automático, consulte a Documentação API para instruções sobre como configurar a automação externa.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Fechamento do Dia</CardTitle><CardDescription>Configure o relatório diário e o fechamento automático.</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="report-phone">Nº de WhatsApp para Relatório</Label>
                  <Input id="report-phone" placeholder="(99) 99999-9999" defaultValue={settings?.daily_report_phone_number || ""} onBlur={(e) => updateSettingsMutation.mutate({ daily_report_phone_number: e.target.value })} />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="auto-close" checked={settings?.auto_close_enabled} onCheckedChange={(checked) => updateSettingsMutation.mutate({ auto_close_enabled: checked })} />
                  <Label htmlFor="auto-close">Habilitar fechamento automático</Label>
                </div>
                {settings?.auto_close_enabled && (
                  <div>
                    <Label htmlFor="auto-close-time">Horário do Fechamento</Label>
                    <Input id="auto-close-time" type="time" defaultValue={settings?.auto_close_time || "23:00"} onBlur={(e) => updateSettingsMutation.mutate({ auto_close_time: e.target.value })} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Automação de Pedidos</CardTitle><CardDescription>Configure um item para ser adicionado automaticamente quando um cliente senta à mesa.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="auto-add-item" checked={settings?.auto_add_item_enabled} onCheckedChange={(checked) => updateSettingsMutation.mutate({ auto_add_item_enabled: checked })} />
                <Label htmlFor="auto-add-item">Habilitar item de entrada automático</Label>
              </div>
              {settings?.auto_add_item_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="default-product">Produto Padrão</Label>
                  <Select value={settings?.default_produto_id || ""} onValueChange={(value) => updateSettingsMutation.mutate({ default_produto_id: value })}>
                    <SelectTrigger id="default-product">
                      <SelectValue placeholder="Selecione o produto padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map(produto => (
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
    </div>
  );
}

function AppearanceSettings({ settings, isLoading }: { settings: UserSettings | null, isLoading: boolean }) {
  const updateSettingsMutation = useSettingsMutator();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Estilo do Menu</CardTitle><CardDescription>Escolha como você prefere navegar pelo sistema.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-24 w-full" /> : (
            <RadioGroup value={settings?.menu_style || 'sidebar'} onValueChange={(value) => updateSettingsMutation.mutate({ menu_style: value })} className="space-y-2">
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
      <Card>
        <CardHeader><CardTitle>Vídeo de Fundo do Login</CardTitle><CardDescription>Defina a URL do vídeo que será exibido na tela de login.</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-16 w-full" /> : (
            <div className="space-y-2">
              <Label htmlFor="login-video-url">URL do Vídeo (MP4)</Label>
              <Input
                id="login-video-url"
                placeholder="https://seu-servidor.com/video.mp4, /videos/local.mp4"
                defaultValue={settings?.login_video_url || ""}
                onBlur={(e) => updateSettingsMutation.mutate({ login_video_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Se vazio, será usado o vídeo padrão. Você pode inserir múltiplas URLs separadas por vírgula para que o sistema escolha uma aleatoriamente.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecognitionSettings({ settings, isLoading }: { settings: UserSettings | null, isLoading: boolean }) {
  const updateSettingsMutation = useSettingsMutator();

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-compreface-connection');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => showSuccess(data.message),
    onError: (error: Error) => showError(`Teste falhou: ${error.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Servidor de Reconhecimento (CompreFace)</CardTitle><CardDescription>Conecte seu servidor CompreFace auto-hospedado.</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="compreface-url">URL do Servidor CompreFace</Label>
                  <Input
                    id="compreface-url"
                    placeholder="http://seu-servidor:8000"
                    defaultValue={settings?.compreface_url || ""}
                    onBlur={(e) => updateSettingsMutation.mutate({ compreface_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="compreface-key">Chave de API de Reconhecimento</Label>
                  <Input
                    id="compreface-key"
                    type="password"
                    placeholder="Sua chave de API"
                    defaultValue={settings?.compreface_api_key || ""}
                    onBlur={(e) => updateSettingsMutation.mutate({ compreface_api_key: e.target.value })}
                  />
                </div>
                <Button 
                  onClick={() => testConnectionMutation.mutate()} 
                  disabled={testConnectionMutation.isPending}
                  variant="secondary"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {testConnectionMutation.isPending ? "Testando Conexão..." : "Testar Conexão"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Câmera Padrão</CardTitle><CardDescription>Escolha a câmera que será usada como padrão em todo o sistema.</CardDescription></CardHeader>
          <CardContent>
            <CameraSettings onSave={(values) => updateSettingsMutation.mutate(values)} />
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader><CardTitle>Teste de Reconhecimento em Tempo Real</CardTitle><CardDescription>Use sua câmera para testar a conexão e a precisão do reconhecimento facial.</CardDescription></CardHeader>
        <CardContent>
          <RecognitionTester />
        </CardContent>
      </Card>
    </div>
  );
}

// --- Página Principal ---

export default function ConfiguracoesPage() {
  const { settings, isLoading: isLoadingSettings } = useSettings();

  const { data, isLoading: isLoadingPage, isError } = useQuery({
    queryKey: ["configPageData"],
    queryFn: fetchPageData,
  });

  const isLoading = isLoadingSettings || isLoadingPage;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie as informações da sua conta, integrações e automações.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="perfil">Perfil & Integrações</TabsTrigger>
          <TabsTrigger value="automacao">Automação</TabsTrigger>
          <TabsTrigger value="reconhecimento">Reconhecimento Facial</TabsTrigger>
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
          <TabsTrigger value="api">Documentação API</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6">
          <ProfileAndIntegrations settings={settings} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="automacao" className="mt-6">
          <AutomationSettings 
            settings={settings} 
            isLoading={isLoading} 
            templates={data?.templates || []} 
            produtos={data?.produtos || []} 
          />
        </TabsContent>

        <TabsContent value="reconhecimento" className="mt-6">
          <RecognitionSettings settings={settings} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="aparencia" className="mt-6">
          <AppearanceSettings settings={settings} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <ApiDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
}