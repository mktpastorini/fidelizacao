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

const formSchema = z.object({
  webhook_url: z.string().url({ message: "Por favor, insira uma URL válida." }).or(z.literal("")),
});

type WebhookFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<UserSettings>;
};

export function WebhookForm({ onSubmit, isSubmitting, defaultValues }: WebhookFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      webhook_url: defaultValues?.webhook_url || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="webhook_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL do Webhook para WhatsApp</FormLabel>
              <FormControl>
                <Input placeholder="https://seu-servico.com/webhook" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormDescription>
                Esta URL receberá uma requisição POST com os dados do cliente para envio da mensagem.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Webhook"}
        </Button>
      </form>
    </Form>
  );
}