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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MultiImageCapture } from "@/components/clientes/MultiImageCapture";
import { Loader2 } from "lucide-react";
import { Cozinheiro } from "@/types/supabase";

const formSchema = z.object({
  nome: z.string().min(1, "O nome é obrigatório."),
  email: z.string().email("Email inválido.").optional().or(z.literal("")),
  avatar_urls: z.array(z.string()).min(1, { message: "É necessário pelo menos uma foto para o reconhecimento." }),
});

type CozinheiroFormValues = z.infer<typeof formSchema> & { id?: string };

type CozinheiroFormProps = {
  onSubmit: (values: CozinheiroFormValues & { avatar_url: string | null }) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<Cozinheiro>;
  isEditing: boolean;
};

export function CozinheiroForm({ onSubmit, isSubmitting, defaultValues, isEditing }: CozinheiroFormProps) {
  const form = useForm<CozinheiroFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      email: defaultValues?.email || "",
      avatar_urls: defaultValues?.avatar_url ? [defaultValues.avatar_url] : [],
    },
  });

  const handleSubmit = (values: CozinheiroFormValues) => {
    const submissionData = {
      ...values,
      avatar_url: values.avatar_urls[0] || null,
    };
    onSubmit(submissionData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="avatar_urls"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fotos para Reconhecimento</FormLabel>
              <FormControl>
                <MultiImageCapture
                  urls={field.value || []}
                  onUrlsChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome do cozinheiro" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Opcional)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@contato.com" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (isEditing ? "Salvar Cozinheiro" : "Cadastrar Cozinheiro")}
        </Button>
      </form>
    </Form>
  );
}