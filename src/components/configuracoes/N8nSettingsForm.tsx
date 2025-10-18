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
import { Input } from "@/components/ui/input";
import { UserSettings } from "@/types/supabase";
import { showError, showSuccess } from "@/utils/toast";

const formSchema = z.object({
  n8n_webhook_url: z.string().url({ message: "Por favor, insira uma URL válida." }).or(z.literal("")),
  n8n_api_key: z.string().optional(),
});

type N8nSettingsFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<UserSettings>;
};

export function N8nSettingsForm({ onSubmit, isSubmitting, defaultValues }: N8nSettingsFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      n8n_webhook_url: defaultValues?.n8n_webhook_url || "",
      n8n_api_key: defaultValues?.n8n_api_key || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="n8n_webhook_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL do Webhook n8n</FormLabel>
              <FormControl>
                <Input placeholder="https://seu-n8n.com/webhook" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormDescription>
                Esta URL será chamada sempre que o horário de envio for atualizado.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="n8n_api_key"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chave de API n8n (opcional)</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Sua chave de API do n8n" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormDescription>
                Se seu webhook n8n requer autenticação, insira a chave aqui.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Configurações n8n"}
        </Button>
      </form>
    </Form>
  );
}