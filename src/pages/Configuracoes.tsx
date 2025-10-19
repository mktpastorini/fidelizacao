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
import { Copy, RefreshCw, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings } from "@/contexts/SettingsContext";
import { N8nSettingsForm } from "@/components/configuracoes/N8nSettingsForm";

type UserData = {
  templates: MessageTemplate[];
  produtos: Produto[];
};

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

async function fetchPageData(): Promise<UserData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { templates: [], produtos: [] };

  const { data: templates, error: templatesError } = await supabase.from("message_templates").select("*");
  if (templatesError) throw new Error(`Erro ao buscar templates: ${templatesError.message}`);

  const { data: produtos, error: produtosError } = await supabase.from("produtos").select("*").order("nome");
  if (produtosError) throw new Error(`Erro ao buscar produtos: ${produtosError.message}`);

  return { templates: templates || [], produtos: produtos || [] };
}

function CompreFaceSettingsForm() {
  const { settings, refetch: refetchSettings } = useSettings();
  const queryClient = useQueryClient();

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<UserSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("user_settings").upsert({ id: user.id, ...updatedSettings });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchSettings();
      showSuccess("Configurações do CompreFace salvas!");
    },
    onError: (error: Error) => showError(error.message),
  });

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
      <Button onClick={() => testConnectionMutation.mutate()} disabled={testConnectionMutation.isPending}>
        {testConnectionMutation.isPending ? "Testando..." : "Testar Conexão"}
      </Button>
    </div>
  );
}

// Função para enviar notificação para o n8n
async function sendN8nNotification(settings: UserSettings | null, newTime: string) {
  if (!settings?.n8n_webhook_url) return;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Adiciona chave de API se fornecida
    if (settings.n8n_api_key) {
      headers['Authorization'] = `Bearer ${settings.n8n_api_key}`;
    }
    
    // Envia notificação para o n8n
    const response = await fetch(settings.n8n_webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'birthday_schedule_updated',
        new_time: newTime,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      console.error('Falha ao notificar n8n:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Erro ao notificar n8n:', error);
  }
}

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient();
  const { settings, refetch: refetchSettings, isLoading: isLoadingSettings } = useSettings();

  const { data, isLoading: isLoadingPage, isError } = useQuery({
    queryKey: ["configPageData"],
    queryFn: fetchPageData,
  });

  const isLoading = isLoadingSettings || isLoadingPage;

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

  const updateBirthdayTimeMutation = useMutation({
    mutationFn: async (newTime: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // Atualiza as configurações no banco de dados
      const settingsToUpsert = { id: user.id, aniversario_horario: newTime };
      const { error: updateError } = await supabase.from("user_settings").upsert(settingsToUpsert);
      if (updateError) throw new Error(updateError.message);

      // Envia notificação para o n8n
      await sendN8nNotification(settings, newTime);
    },
    onSuccess: () => {
      refetchSettings();
      showSuccess("Horário de aniversário atualizado com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const updateSettingsWithN8nNotificationMutation = useMutation({
    mutationFn: async (updatedSettings: Partial<UserSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // Atualiza as configurações no banco de dados
      const settingsToUpsert = { id: user.id, ...updatedSettings };
      const { error: updateError } = await supabase.from("user_settings").upsert(settingsToUpsert);
      if (updateError) throw new Error(updateError.message);

      // Se houver uma URL do webhook n8n configurada, notifica sobre a mudança
      if (settings?.n8n_webhook_url && updatedSettings.aniversario_horario) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          // Adiciona chave de API se fornecida
          if (settings.n8n_api_key) {
            headers['Authorization'] = `Bearer ${settings.n8n_api_key}`;
          }
          
          // Envia notificação para o n8n
          const response = await fetch(settings.n8n_webhook_url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              event: 'birthday_schedule_updated',
              new_time: updatedSettings.aniversario_horario,
              timestamp: new Date().toISOString()
            })
          });
          
          if (!response.ok) {
            console.error('Falha ao notificar n8n:', response.status, await response.text());
          }
        } catch (error) {
          console.error('Erro ao notificar n8n:', error);
        }
      }
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

  const testN8nWebhookMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.n8n_webhook_url) {
        throw new Error("Nenhuma URL de webhook n8n configurada.");
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Adiciona chave de API se fornecida
      if (settings.n8n_api_key) {
        headers['Authorization'] = `Bearer ${settings.n8n_api_key}`;
      }
      
      // Envia notificação de teste para o n8n
      const response = await fetch(settings.n8n_webhook_url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: 'test_connection',
          message: 'Teste de conexão bem-sucedido do Fidelize',
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao testar webhook n8n: ${response.status} - ${errorText}`);
      }
      
      return response;
    },
    onSuccess: () => {
      showSuccess("Webhook n8n testado com sucesso! Verifique seu serviço para a mensagem de teste.");
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

  const sendBirthdayWishesMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('trigger-birthday-wishes');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => showSuccess(data.message),
    onError: (error: Error) => showError(error.message),
  });

  const handleCopy = (text: string | null | undefined) => {
    if (text) {
      navigator.clipboard.writeText(text);
      showSuccess("Chave de API copiada!");
    }
  };

  const birthdayTemplates = data?.templates.filter(t => t.tipo === 'aniversario' || t.tipo === 'geral') || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-gray-600 mt-2">
          Gerencie as informações da sua conta, integrações e automações.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="perfil">Perfil & Integrações</TabsTrigger>
          <TabsTrigger value="automacao">Automação</TabsTrigger>
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
          <TabsTrigger value="reconhecimento">Reconhecimento Facial</TabsTrigger>
          <TabsTrigger value="api">Documentação API</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Chave de API</CardTitle><CardDescription>Use esta chave para autenticar requisições à API do Fidelize.</CardDescription></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-20 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (<div className="space-y-4"><div className="flex items-center gap-2"><Input readOnly value={settings?.api_key || "Nenhuma chave gerada"} /><Button variant="outline" size="icon" onClick={() => handleCopy(settings?.api_key)}><Copy className="w-4 h-4" /></Button></div><Button variant="secondary" onClick={() => regenerateApiKeyMutation.mutate()} disabled={regenerateApiKeyMutation.isPending}><RefreshCw className="w-4 h-4 mr-2" />{regenerateApiKeyMutation.isPending ? "Gerando..." : "Gerar Nova Chave"}</Button></div>)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Integrações</CardTitle><CardDescription>Configure seu webhook para automações de WhatsApp.</CardDescription></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-24 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar as configurações.</p> : (<WebhookForm onSubmit={(values) => updateSettingsMutation.mutate(values)} isSubmitting={updateSettingsMutation.isPending} defaultValues={settings || undefined} onTest={() => testWebhookMutation.mutate()} isTesting={testWebhookMutation.isPending} />)}</CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automacao" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Automação de Mensagens</CardTitle><CardDescription>Escolha os templates para cada evento automático.</CardDescription></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-24 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar os templates.</p> : (<TemplateSettingsForm onSubmit={(values) => updateSettingsMutation.mutate(values)} isSubmitting={updateSettingsMutation.isPending} defaultValues={settings || undefined} templates={data?.templates || []} />)}</CardContent>
            </Card>
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
                        onBlur={(e) => updateBirthdayTimeMutation.mutate(e.target.value)} 
                      />
                    </div>
                    <Button 
                      onClick={() => sendBirthdayWishesMutation.mutate()} 
                      disabled={sendBirthdayWishesMutation.isPending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendBirthdayWishesMutation.isPending ? "Enviando..." : "Enviar para Aniversariantes de Hoje (Manual)"}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Para envio automático, consulte a Documentação API para instruções sobre como configurar a automação externa.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Integração com n8n</CardTitle>
                <CardDescription>Configure a conexão com sua automação no n8n.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-32 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (
                  <N8nSettingsForm 
                    onSubmit={(values) => updateSettingsMutation.mutate(values)} 
                    isSubmitting={updateSettingsMutation.isPending} 
                    defaultValues={settings || undefined} 
                    onTest={() => testN8nWebhookMutation.mutate()}
                    isTesting={testN8nWebhookMutation.isPending}
                    aniversario_horario={settings?.aniversario_horario}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Automação de Pedidos</CardTitle><CardDescription>Configure um item para ser adicionado automaticamente quando um cliente senta à mesa.</CardDescription></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-32 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (<div className="space-y-4"><div className="flex items-center space-x-2"><Switch id="auto-add-item" checked={settings?.auto_add_item_enabled} onCheckedChange={(checked) => updateSettingsMutation.mutate({ auto_add_item_enabled: checked })} /><Label htmlFor="auto-add-item">Habilitar item de entrada automático</Label></div>{settings?.auto_add_item_enabled && (<div className="space-y-2"><Label htmlFor="default-product">Produto Padrão</Label><Select value={settings?.default_produto_id || ""} onValueChange={(value) => updateSettingsMutation.mutate({ default_produto_id: value })}><SelectTrigger id="default-product"><SelectValue placeholder="Selecione o produto padrão" /></SelectTrigger><SelectContent>{data?.produtos.map(produto => (<SelectItem key={produto.id} value={produto.id}>{produto.nome}</SelectItem>))}</SelectContent></Select></div>)}</div>)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Fechamento do Dia</CardTitle><CardDescription>Configure o relatório diário e o fechamento automático.</CardDescription></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-40 w-full" /> : isError ? <p className="text-red-500">Erro ao carregar.</p> : (<div className="space-y-4"><div><Label htmlFor="report-phone">Nº de WhatsApp para Relatório</Label><Input id="report-phone" placeholder="(99) 99999-9999" defaultValue={settings?.daily_report_phone_number || ""} onBlur={(e) => updateSettingsMutation.mutate({ daily_report_phone_number: e.target.value })} /></div><div className="flex items-center space-x-2"><Switch id="auto-close" checked={settings?.auto_close_enabled} onCheckedChange={(checked) => updateSettingsMutation.mutate({ auto_close_enabled: checked })} /><Label htmlFor="auto-close">Habilitar fechamento automático</Label></div>{settings?.auto_close_enabled && (<div><Label htmlFor="auto-close-time">Horário do Fechamento</Label><Input id="auto-close-time" type="time" defaultValue={settings?.auto_close_time || "23:00"} onBlur={(e) => updateSettingsMutation.mutate({ auto_close_time: e.target.value })} /></div>)}</div>)}</CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aparencia" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Estilo do Menu</CardTitle><CardDescription>Escolha como você prefere navegar pelo sistema.</CardDescription></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-24 w-full" /> : (<RadioGroup value={settings?.menu_style || 'sidebar'} onValueChange={(value) => updateSettingsMutation.mutate({ menu_style: value })} className="space-y-2"><div className="flex items-center space-x-2"><RadioGroupItem value="sidebar" id="sidebar" /><Label htmlFor="sidebar">Barra Lateral (Padrão)</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="dock" id="dock" /><Label htmlFor="dock">Dock Inferior</Label></div></RadioGroup>)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconhecimento" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Servidor de Reconhecimento (CompreFace)</CardTitle><CardDescription>Conecte seu servidor CompreFace auto-hospedado.</CardDescription></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-32 w-full" /> : <CompreFaceSettingsForm />}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Configuração da Câmera</CardTitle><CardDescription>Escolha a câmera que será usada como padrão em todo o sistema.</CardDescription></CardHeader>
              <CardContent><CameraSettings onSave={(values) => updateSettingsMutation.mutate(values)} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <ApiDocumentation />
        </TabsContent>
      </Tabs>
    </div>
  );
}