import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface StepProps {
  form: UseFormReturn<any>;
}

export function Step4_Address({ form }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField control={form.control} name="address_street" render={({ field }) => (<FormItem className="col-span-2"><FormLabel className="text-sm">Rua</FormLabel><FormControl><Input placeholder="Rua das Flores" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="address_number" render={({ field }) => (<FormItem><FormLabel className="text-sm">Número</FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="address_neighborhood" render={({ field }) => (<FormItem><FormLabel className="text-sm">Bairro</FormLabel><FormControl><Input placeholder="Centro" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="address_city" render={({ field }) => (<FormItem><FormLabel className="text-sm">Cidade</FormLabel><FormControl><Input placeholder="São Paulo" {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>
      <FormField control={form.control} name="address_complement" render={({ field }) => (<FormItem><FormLabel className="text-sm">Complemento (Opcional)</FormLabel><FormControl><Input placeholder="Apto 42, Bloco B" {...field} /></FormControl><FormMessage /></FormItem>)} />
    </div>
  );
}