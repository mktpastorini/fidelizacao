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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Produto } from "@/types/supabase";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome do produto é obrigatório." }),
  preco: z.coerce.number().min(0, { message: "O preço não pode ser negativo." }),
  descricao: z.string().optional(),
  tipo: z.enum(["venda", "rodizio", "componente_rodizio"]),
  requer_preparo: z.boolean().default(true),
});

type ProdutoFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<Produto>;
};

export function ProdutoForm({ onSubmit, isSubmitting, defaultValues }: ProdutoFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      preco: defaultValues?.preco || undefined,
      descricao: defaultValues?.descricao || "",
      tipo: defaultValues?.tipo || "venda",
      requer_preparo: defaultValues?.requer_preparo ?? true,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Produto</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Pizza de Calabresa" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Produto (Cobrança)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="venda">Venda Direta (Ex: Bebida, Sobremesa)</SelectItem>
                  <SelectItem value="rodizio">Pacote Rodízio (Ex: Rodízio Completo)</SelectItem>
                  <SelectItem value="componente_rodizio">Item de Rodízio (Ex: Picanha, Coração)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="preco"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preço (R$)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="29.90" {...field} />
              </FormControl>
              <FormDescription>Para "Item de Rodízio", use o preço 0.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="requer_preparo"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Requer Preparo na Cozinha?</FormLabel>
                <FormDescription>
                  Marque se este item deve aparecer no painel da cozinha para ser preparado.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Uma breve descrição do produto"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Produto"}
        </Button>
      </form>
    </Form>
  );
}