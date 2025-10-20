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
  login_video_url: z.string().url({ message: "Por favor, insira uma URL de vídeo válida." }).or(z.literal("")),
});

type LoginVideoSettingsFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<UserSettings>;
};

export function LoginVideoSettingsForm({ onSubmit, isSubmitting, defaultValues }: LoginVideoSettingsFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      login_video_url: defaultValues?.login_video_url || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="login_video_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL do Vídeo de Fundo (MP4, WebM, etc.)</FormLabel>
              <FormControl>
                <Input placeholder="https://seuservidor.com/video.mp4" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormDescription>
                Use um vídeo curto e otimizado para o fundo da tela de login. Deixe vazio para usar o fundo padrão.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </form>
    </Form>
  );
}