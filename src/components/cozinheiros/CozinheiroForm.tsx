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
import { Cozinheiro } from "@/types/supabase";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome é obrigatório." }),
  email: z.string().email("Email inválido.").optional().or(z.literal("")),
  avatar_urls: z.array(z.string()).min(1, { message: "É necessário pelo menos uma foto para o reconhecimento." }),
});

type CozinheiroFormProps = {
  onSubmit: (values: z.infer<typeof formSchema> & { avatar_url?: string | null }) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<Cozinheiro>;
};

export function CozinheiroForm({ onSubmit, isSubmitting, defaultValues }: CozinheiroFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      email: defaultValues?.email || "",
      avatar_urls: defaultValues?.avatar_url ? [defaultValues.avatar_url] : [],
    },
  });

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    const submissionData = {
      ...values,
      avatar_url: values.avatar_urls[0] || null, // A primeira imagem é a principal
    };
    onSubmit(submissionData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="avatar_urls"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fotos do Cozinheiro</FormLabel>
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
                <Input placeholder="Nome do cozinheiro" {...field} />
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
                <Input placeholder="email@exemplo.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Salvar Cozinheiro"}
        </Button>
      </form>
    </Form>
  );
}