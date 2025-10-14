import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageTemplate, MessageLog } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageTemplateForm } from "@/components/mensagens/MessageTemplateForm";
import { DefaultTemplates } from "@/components/mensagens/DefaultTemplates";
import { LogDetailsModal } from "@/components/mensagens/LogDetailsModal";
import { PlusCircle, MoreHorizontal, Trash2, Edit, Eye } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

async function fetchMessageTemplates(): Promise<MessageTemplate[]> {
  const { data, error } = await supabase.from("message_templates").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchMessageLogs(): Promise<MessageLog[]> {
  const { data, error } = await supabase
    .from("message_logs")
    .select("*, cliente:clientes(nome), template:message_templates(nome)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as any[]) || [];
}

export default function MensagensPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);

  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["message_templates"],
    queryFn: fetchMessageTemplates,
  });

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["message_logs"],
    queryFn: fetchMessageLogs,
  });

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) setEditingTemplate(null);
    setIsDialogOpen(isOpen);
  };

  const handleLogModalOpen = (log: MessageLog) => {
    setSelectedLog(log);
    setIsLogModalOpen(true);
  };

  const addTemplateMutation = useMutation({
    mutationFn: async (newTemplate: Omit<MessageTemplate, 'id' | 'created_at' | 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("message_templates").insert([{ ...newTemplate, user_id: user.id }]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message_templates"] });
      showSuccess("Template adicionado com sucesso!");
      handleDialogChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const editTemplateMutation = useMutation({
    mutationFn: async (updatedTemplate: Partial<MessageTemplate>) => {
      const { id, ...templateInfo } = updatedTemplate;
      const { error } = await supabase.from("message_templates").update(templateInfo).eq("id", id!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message_templates"] });
      showSuccess("Template atualizado com sucesso!");
      handleDialogChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from("message_templates").delete().eq("id", templateId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message_templates"] });
      showSuccess("Template excluído com sucesso!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const handleSubmit = (values: any) => {
    if (editingTemplate) {
      editTemplateMutation.mutate({ ...values, id: editingTemplate.id });
    } else {
      addTemplateMutation.mutate(values);
    }
  };

  const getBadgeClassName = (type: string) => {
    switch (type) {
      case 'chegada': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'pagamento': return 'bg-green-100 text-green-800 hover:bg-green-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mensagens</h1>
          <p className="text-gray-600 mt-2">Crie templates e acompanhe o histórico de envios.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="w-4 h-4 mr-2" />Adicionar Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>{editingTemplate ? "Editar Template" : "Adicionar Novo Template"}</DialogTitle></DialogHeader>
            <MessageTemplateForm onSubmit={handleSubmit} isSubmitting={addTemplateMutation.isPending || editTemplateMutation.isPending} defaultValues={editingTemplate || undefined} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Meus Templates</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Envios</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-6">
          {!isLoadingTemplates && templates && (
            <DefaultTemplates onAdd={(template) => addTemplateMutation.mutate(template)} existingTemplateNames={templates.map(t => t.nome)} />
          )}
          <div className="bg-white p-6 rounded-lg shadow-md">
            {isLoadingTemplates ? <p>Carregando templates...</p> : templates && templates.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.nome}</TableCell>
                      <TableCell><Badge variant="outline" className={cn("border-transparent", getBadgeClassName(template.tipo))}>{template.tipo.charAt(0).toUpperCase() + template.tipo.slice(1)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => { setEditingTemplate(template); setIsDialogOpen(true); }}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500" onClick={() => deleteTemplateMutation.mutate(template.id)} disabled={deleteTemplateMutation.isPending}><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <div className="text-center py-12"><p className="text-gray-500">Nenhum template de mensagem cadastrado.</p></div>}
          </div>
        </TabsContent>
        <TabsContent value="historico" className="mt-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            {isLoadingLogs ? <p>Carregando histórico...</p> : logs && logs.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.cliente?.nome || "N/A"}</TableCell>
                      <TableCell>{format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'sucesso' ? 'default' : 'destructive'} className={cn(log.status === 'sucesso' && "bg-green-600 hover:bg-green-700")}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleLogModalOpen(log)}><Eye className="w-4 h-4 mr-2" />Detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <div className="text-center py-12"><p className="text-gray-500">Nenhum registro de envio encontrado.</p></div>}
          </div>
        </TabsContent>
      </Tabs>

      <LogDetailsModal isOpen={isLogModalOpen} onOpenChange={setIsLogModalOpen} log={selectedLog} />
    </div>
  );
}