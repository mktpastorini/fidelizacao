import { useForm, useFieldArray } from "react-hook-form";
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
import { Trash2, PlusCircle } from "lucide-react";
import { Cliente, Filho } from "@/types/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome é obrigatório." }),
  casado_com: z.string().optional(),
  whatsapp: z.string().optional(),
  avatar_url: z.string().nullable().optional(),
  indicado_por_id: z.string().uuid().optional().nullable().or(z.literal("none")).transform(val => val === "none" ? null : val),
  gostos: z.object({
    pizza_favorita: z.string().optional(),
    bebida_favorita: z.string().optional(),
    apos_comer: z.string().optional(),
  }).optional(),
  filhos: z.array(
    z.object({
      nome: z.string().min(1, { message: "Nome do filho é obrigatório." }),
      idade: z.coerce.number().positive().int().optional().nullable(),
    })
  ).optional(),
});

type ClienteFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<Cliente & { filhos: Filho[] }>;
  clientes: Cliente[];
  isEditing?: boolean;
};

export function ClienteForm({ onSubmit, isSubmitting, defaultValues, clientes, isEditing }: ClienteFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      casado_com: defaultValues?.casado_com || "",
      whatsapp: defaultValues?.whatsapp || "",
      avatar_url: defaultValues?.avatar_url || null,
      indicado_por_id: defaultValues?.indicado_por_id || "none",
      gostos: {
        pizza_favorita: defaultValues?.gostos?.pizza_favorita || "",
        bebida_favorita: defaultValues?.gostos?.bebida_favorita || "",
        apos_comer: defaultValues?.gostos?.apos_comer || "",
      },
      filhos: defaultValues?.filhos || [],
    },
  });

  const { fields: filhosFields, append: appendFilho, remove: removeFilho } = useFieldArray({
    control: form.control,
    name: "filhos",
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Foto do Cliente</FormLabel>
              <FormControl>
                <ImageCapture
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
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome do cliente" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="casado_com"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Casado(a) com</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do cônjuge" {...field} />
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
                <FormLabel>WhatsApp</FormLabel>
                <FormControl>
                  <Input placeholder="(99) 99999-9999" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {!isEditing && (
          <FormField
            control={form.control}
            name="indicado_por_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Indicado por</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || "none"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione quem indicou este cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Ninguém / Indicação própria</SelectItem>
                    {clientes.map(cliente => (
                      <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div>
          <FormLabel>Gostos e Preferências</FormLabel>
          <div className="space-y-4 mt-2 p-4 border rounded-md">
            <FormField control={form.control} name="gostos.pizza_favorita" render={({ field }) => (<FormItem><FormLabel className="text-sm">Pizza Favorita</FormLabel><FormControl><Input placeholder="Calabresa, 4 Queijos..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="gostos.bebida_favorita" render={({ field }) => (<FormItem><FormLabel className="text-sm">Bebida Favorita</FormLabel><FormControl><Input placeholder="Coca-Cola, Suco de Laranja..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="gostos.apos_comer" render={({ field }) => (<FormItem><FormLabel className="text-sm">Após Comer (Sobremesa/Café)</FormLabel><FormControl><Textarea placeholder="Café expresso, Petit Gâteau..." {...field} /></FormControl><FormMessage /></FormItem>)} />
          </div>
        </div>

        <div>
          <FormLabel>Filhos</FormLabel>
          <div className="space-y-2 mt-2">
            {filhosFields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <FormField control={form.control} name={`filhos.${index}.nome`} render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Nome do filho" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`filhos.${index}.idade`} render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="Idade" {...field} onChange={e => field.onChange(e.target.value === '' ? null : e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                <Button type="button" variant="destructive" size="icon" onClick={() => removeFilho(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendFilho({ nome: "", idade: null })}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Filho</Button>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Salvando..." : "Salvar Cliente"}
        </Button>
      </form>
    </Form>
  );
}