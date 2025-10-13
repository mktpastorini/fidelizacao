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
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { Cliente, Filho } from "@/types/supabase";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome é obrigatório." }),
  casado_com: z.string().optional(),
  whatsapp: z.string().optional(),
  gostos: z.string().optional(),
  indicacoes: z.coerce.number().int().nonnegative().optional(),
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
};

export function ClienteForm({ onSubmit, isSubmitting, defaultValues }: ClienteFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      casado_com: defaultValues?.casado_com || "",
      whatsapp: defaultValues?.whatsapp || "",
      gostos: defaultValues?.gostos ? JSON.stringify(defaultValues.gostos, null, 2) : "",
      indicacoes: defaultValues?.indicacoes || 0,
      filhos: defaultValues?.filhos || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "filhos",
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            name="indicacoes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Indicações</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
        <FormField
          control={form.control}
          name="gostos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gostos e Preferências</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Ex: { "pizza_favorita": "Calabresa", "bebida": "Chá de boldo" }'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Filhos</FormLabel>
          <div className="space-y-2 mt-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name={`filhos.${index}.nome`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Nome do filho" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`filhos.${index}.idade`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="number" placeholder="Idade" {...field} onChange={e => field.onChange(e.target.value === '' ? null : e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => append({ nome: "", idade: null })}
          >
            Adicionar Filho
          </Button>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar Cliente"}
        </Button>
      </form>
    </Form>
  );
}