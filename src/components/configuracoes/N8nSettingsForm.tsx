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
  onTest: () => void;
  isTesting: boolean;
  aniversario_horario?: string | null;
};

export function N8nSettingsForm({ onSubmit, isSubmitting, defaultValues, onTest, isTesting, aniversario_horario }: N8nSettingsFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      n8n_webhook_url: defaultValues?.n8n_webhook_url || "",
      n8n_api_key: defaultValues?.n8n_api_key || "",
    },
  });

  const { isDirty } = form.formState;

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    // Call the original submit function
    onSubmit(values);
    
    // If there's a webhook URL, send notification to n8n
    if (values.n8n_webhook_url && aniversario_horario) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Add API key if provided
        if (values.n8n_api_key) {
          headers['Authorization'] = `Bearer ${values.n8n_api_key}`;
        }
        
        // Send notification to n8n
        const response = await fetch(values.n8n_webhook_url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            event: 'birthday_schedule_updated',
            new_time: aniversario_horario,
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
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isSubmitting || isTesting}>
            {isSubmitting ? "Salvando..." : "Salvar Configurações n8n"}
          </Button>
          <Button type="button" variant="outline" onClick={onTest} disabled={isDirty || isTesting || isSubmitting}>
            {isTesting ? "Testando..." : "Testar"}
          </Button>
        </div>
        {isDirty && <p className="text-xs text-muted-foreground">Você tem alterações não salvas. Salve antes de testar.</p>}
      </form>
    </Form>
  );
}