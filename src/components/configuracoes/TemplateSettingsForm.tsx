import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserSettings, MessageTemplate } from "@/types/supabase";

const formSchema = z.object({
  chegada_template_id: z.string().nullable(),
  pagamento_template_id: z.string().nullable(),
});

type TemplateSettingsFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<UserSettings>;
  templates: MessageTemplate[];
};

export function TemplateSettingsForm({
  onSubmit,
  isSubmitting,
  defaultValues,
  templates,
}: TemplateSettingsFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chegada_template_id: defaultValues?.chegada_template_id || null,
      pagamento_template_id: defaultValues?.pagamento_template_id || null,
    },
  });

  const chegadaTemplates = templates.filter(t => t.tipo === 'chegada' || t.tipo === 'geral');
  const pagamentoTemplates = templates.filter(t => t.tipo === 'pagamento' || t.tipo === 'geral');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="chegada_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template de Chegada</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template para a chegada do cliente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {chegadaTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Esta mensagem será enviada via webhook quando um cliente for reconhecido.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pagamento_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Pós-Pagamento</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template para o pós-pagamento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {pagamentoTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>{template.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Esta mensagem será enviada via webhook após a confirmação do pagamento.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Templates"}
        </Button>
      </form>
    </Form>
  );
}