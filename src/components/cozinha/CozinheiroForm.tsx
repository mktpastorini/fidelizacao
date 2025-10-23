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

const formSchema = z.object({
  first_name: z.string().min(1, "O nome é obrigatório."),
  last_name: z.string().optional(),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").optional(),
  avatar_urls: z.array(z.string()).min(1, { message: "É necessário pelo menos uma foto para o reconhecimento." }),
});

type CozinheiroFormValues = z.infer<typeof formSchema> & { id?: string };

type CozinheiroFormProps = {
  onSubmit: (values: CozinheiroFormValues) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<CozinheiroFormValues>;
  isEditing: boolean;
};

export function CozinheiroForm({ onSubmit, isSubmitting, defaultValues, isEditing }: CozinheiroFormProps) {
  const form = useForm<CozinheiroFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: defaultValues?.first_name || "",
      last_name: defaultValues?.last_name || "",
      email: defaultValues?.email || "",
      password: "",
      avatar_urls: defaultValues?.avatar_urls || [],
    },
  });

  const handleSubmit = (values: CozinheiroFormValues) => {
    // Remove a senha se estiver vazia no modo de edição
    if (isEditing && !values.password) {
      const { password, ...rest } = values;
      onSubmit(rest);
    } else {
      onSubmit(values);
    }
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Primeiro nome" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sobrenome (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Sobrenome" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="email@cozinha.com" {...field} disabled={isSubmitting || isEditing} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isEditing && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Mínimo 6 caracteres" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          )}
        {isEditing && (
            <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nova Senha (Deixe em branco para manter a atual)</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder="Nova senha" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (isEditing ? "Salvar Cozinheiro" : "Cadastrar Cozinheiro")}
        </Button>
      </form>
    </Form>
  );
}