import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageTemplate } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageTemplateForm } from "@/components/mensagens/MessageTemplateForm";
import { PlusCircle, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";

async function fetchMessageTemplates(): Promise<MessageTemplate[]> {
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export default function MensagensPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  const { data: templates, isLoading, isError } = useQuery({
    queryKey: ["message_templates"],
    queryFn: fetchMessageTemplates,
  });

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEditingTemplate(null);
    }
    setIsDialogOpen(isOpen);
  };

  const addTemplateMutation = useMutation({
    mutationFn: async (newTemplate: Omit<MessageTemplate, 'id' | 'created_at' | 'user_id'>) => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("message_templates").insert([{ ...newTemplate, user_id: userId }]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message_templates"] });
      showSuccess("Template adicionado com sucesso!");
      handleDialogChange(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
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
    onError: (error: Error) => {
      showError(error.message);
    },
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
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleSubmit = (values: any) => {
    if (editingTemplate) {
      editTemplateMutation.mutate({ ...values, id: editingTemplate.id });
    } else {
      addTemplateMutation.mutate(values);
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'chegada':
        return 'default';
      case 'pagamento':
        return 'secondary';
      case 'geral':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Mensagens</h1>
          <p className="text-gray-600 mt-2">
            Crie e gerencie seus templates de mensagens.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Editar Template" : "Adicionar Novo Template"}</DialogTitle>
            </DialogHeader>
            <MessageTemplateForm
              onSubmit={handleSubmit}
              isSubmitting={addTemplateMutation.isPending || editTemplateMutation.isPending}
              defaultValues={editingTemplate || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {isLoading ? (
          <p>Carregando templates...</p>
        ) : isError ? (
          <p className="text-red-500">Erro ao carregar templates.</p>
        ) : templates && templates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.nome}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(template.tipo)}>
                      {template.tipo.charAt(0).toUpperCase() + template.tipo.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingTemplate(template);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                          disabled={deleteTemplateMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum template de mensagem cadastrado.</p>
            <p className="text-gray-500">
              Clique em "Adicionar Template" para criar o primeiro.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}