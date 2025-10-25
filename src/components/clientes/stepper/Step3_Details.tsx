import { UseFormReturn, useFieldArray } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Cliente } from "@/types/supabase";

interface StepProps {
  form: UseFormReturn<any>;
  clientes: Cliente[];
  isEditing?: boolean;
}

export function Step3_Details({ form, clientes, isEditing }: StepProps) {
  const { fields: filhosFields, append: appendFilho, remove: removeFilho } = useFieldArray({
    control: form.control,
    name: "filhos",
  });

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="indicado_por_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Indicado por (Opcional)</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value || "none"} disabled={isEditing}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione quem indicou este cliente" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">Ninguém / Indicação própria</SelectItem>
                {clientes
                  .filter(c => c.id !== form.getValues('id'))
                  .map(cliente => (
                    <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEditing && <FormDescription>A indicação não pode ser alterada após o cadastro.</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />

      <Accordion type="multiple" className="w-full space-y-2">
        <AccordionItem value="item-1" className="border rounded-md px-4">
          <AccordionTrigger>Gostos e Preferências</AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <FormField control={form.control} name="gostos.pizza_favorita" render={({ field }) => (<FormItem><FormLabel className="text-sm">Pizza Favorita</FormLabel><FormControl><Input placeholder="Calabresa, 4 Queijos..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="gostos.bebida_favorita" render={({ field }) => (<FormItem><FormLabel className="text-sm">Bebida Favorita</FormLabel><FormControl><Input placeholder="Coca-Cola, Suco de Laranja..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="gostos.apos_comer" render={({ field }) => (<FormItem><FormLabel className="text-sm">Após Comer (Sobremesa/Café)</FormLabel><FormControl><Textarea placeholder="Café expresso, Petit Gâteau..." {...field} /></FormControl><FormMessage /></FormItem>)} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2" className="border rounded-md px-4">
          <AccordionTrigger>Filhos</AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className="space-y-2">
              {filhosFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <FormField control={form.control} name={`filhos.${index}.nome`} render={({ field }) => (<FormItem className="flex-1"><FormControl><Input placeholder="Nome do filho" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name={`filhos.${index}.idade`} render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="Idade" {...field} onChange={e => field.onChange(e.target.value === '' ? null : e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                  <Button type="button" variant="destructive" size="icon" onClick={() => removeFilho(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendFilho({ nome: "", idade: null })}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Filho</Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}