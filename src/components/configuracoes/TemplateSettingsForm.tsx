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
import { Separator } from "../ui/separator";

const formSchema = z.object({
  chegada_template_id: z.string().nullable(),
  pagamento_template_id: z.string().nullable(),
  delivery_confirmed_template_id: z.string().nullable(),
  delivery_in_preparation_template_id: z.string().nullable(),
  delivery_ready_template_id: z.string().nullable(),
  delivery_out_for_delivery_template_id: z.string().nullable(),
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
      delivery_confirmed_template_id: defaultValues?.delivery_confirmed_template_id || null,
      delivery_in_preparation_template_id: defaultValues?.delivery_in_preparation_template_id || null,
      delivery_ready_template_id: defaultValues?.delivery_ready_template_id || null,
      delivery_out_for_delivery_template_id: defaultValues?.delivery_out_for_delivery_template_id || null,
    },
  });

  const chegadaTemplates = templates.filter(t => t.tipo === 'chegada' || t.tipo === 'geral');
  const pagamentoTemplates = templates.filter(t => t.tipo === 'pagamento' || t.tipo === 'geral');
  const deliveryConfirmedTemplates = templates.filter(t => t.tipo === 'delivery_confirmed' || t.tipo === 'geral');
  const deliveryInPreparationTemplates = templates.filter(t => t.tipo === 'delivery_in_preparation' || t.tipo === 'geral');
  const deliveryReadyTemplates = templates.filter(t => t.tipo === 'delivery_ready' || t.tipo === 'geral');
  const deliveryOutForDeliveryTemplates = templates.filter(t => t.tipo === 'delivery_out_for_delivery' || t.tipo === 'geral');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="chegada_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template de Chegada</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                defaultValue={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template para a chegada do cliente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
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
              <Select
                onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                defaultValue={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template para o pós-pagamento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
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

        <Separator className="my-6" />
        <h3 className="text-lg font-medium">Templates de Delivery</h3>

        <FormField
          control={form.control}
          name="delivery_confirmed_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template - Pedido Confirmado</FormLabel>
              <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} defaultValue={field.value || ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="none">Nenhum</SelectItem>{deliveryConfirmedTemplates.map(t => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}</SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="delivery_in_preparation_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template - Em Preparo</FormLabel>
              <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} defaultValue={field.value || ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="none">Nenhum</SelectItem>{deliveryInPreparationTemplates.map(t => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}</SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="delivery_ready_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template - Pronto para Entrega</FormLabel>
              <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} defaultValue={field.value || ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="none">Nenhum</SelectItem>{deliveryReadyTemplates.map(t => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}</SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="delivery_out_for_delivery_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template - Saiu para Entrega</FormLabel>
              <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} defaultValue={field.value || ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger></FormControl>
                <SelectContent><SelectItem value="none">Nenhum</SelectItem>{deliveryOutForDeliveryTemplates.map(t => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}</SelectContent>
              </Select>
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