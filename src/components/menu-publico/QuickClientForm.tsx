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
import { ImageCapture } from "@/components/clientes/ImageCapture";
import { UserPlus } from "lucide-react";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome é obrigatório." }),
  whatsapp: z.string().optional(),
  avatar_url: z.string().min(1, { message: "É necessário tirar uma foto para o reconhecimento." }),
});

type QuickClientFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
};

export function QuickClientForm({ onSubmit, isSubmitting }: QuickClientFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      whatsapp: "",
      avatar_url: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-primary">Foto para Reconhecimento</FormLabel>
              <FormControl>
                <ImageCapture
                  url={field.value}
                  onUpload={field.onChange}
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
                <Input placeholder="Seu nome" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="(99) 99999-9999" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
          <UserPlus className="w-4 h-4 mr-2" />
          {isSubmitting ? "Cadastrando..." : "Cadastrar e Pedir"}
        </Button>
      </form>
    </Form>
  );
}