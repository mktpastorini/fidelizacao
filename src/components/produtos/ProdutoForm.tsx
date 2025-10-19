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
import { Produto, Categoria } from "@/types/supabase";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome do produto é obrigatório." }),
  preco: z.coerce.number().min(0, { message: "O preço não pode ser negativo." }),
  descricao: z.string().optional(),
  tipo: z.enum(["venda", "rodizio", "componente_rodizio"]),
  requer_preparo: z.boolean().default(true),
  imagem_url: z.string().nullable().optional(),
  categoria_id: z.string().uuid().nullable().optional().or(z.literal("none")).transform(val => val === "none" ? null : val),
  // Inventory fields
  estoque_atual: z.coerce.number().int().min(0, "O estoque atual não pode ser negativo.").default(0),
  alerta_estoque_baixo: z.coerce.number().int().min(0, "O alerta deve ser um número positivo.").default(0),
  valor_compra: z.coerce.number().min(0, "O valor de compra não pode ser negativo.").nullable().optional().transform(val => val === 0 ? null : val),
});

type ProdutoFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<Produto>;
  categorias: Categoria[];
};

export function ProdutoForm({ onSubmit, isSubmitting, defaultValues, categorias }: ProdutoFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      preco: defaultValues?.preco || undefined,
      descricao: defaultValues?.descricao || "",
      tipo: defaultValues?.tipo || "venda",
      requer_preparo: defaultValues?.requer_preparo ?? true,
      imagem_url: defaultValues?.imagem_url || null,
      categoria_id: defaultValues?.categoria_id || "none",
      // Inventory defaults
      estoque_atual: defaultValues?.estoque_atual || 0,
      alerta_estoque_baixo: defaultValues?.alerta_estoque_baixo || 0,
      valor_compra: defaultValues?.valor_compra || undefined,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
        <FormField
          control={form.control}
          name="imagem_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imagem do Produto</FormLabel>
              <FormControl>
                <ImageUpload
                  bucket="client_avatars"
                  url={field.value}
                  onUpload={(url) => field.onChange(url)}
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
          name="categoria_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                value={field.value || "none"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <FormLabel>Preço de Venda (R$)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="29.90" {...field} />
              </FormControl>
              <FormDescription>Para "Item de Rodízio", use o preço 0.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="estoque" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">Gerenciamento de Estoque e Custo</AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              <FormField
                control={form.control}
                name="valor_compra"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de Compra / Custo (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="15.00" 
                        {...field} 
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estoque_atual"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Atual</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="alerta_estoque_baixo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alerta de Estoque Baixo (Quantidade)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormDescription>Receba um alerta visual quando o estoque atingir ou cair abaixo desta quantidade.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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