import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Cliente, Produto } from "@/types/supabase";
import { Check, ChevronsUpDown, PlusCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const orderItemSchema = z.object({
  produtoId: z.string(),
  nome_produto: z.string(),
  quantidade: z.coerce.number().min(1),
  preco: z.coerce.number(),
  requer_preparo: z.boolean(),
});

const deliveryFormSchema = z.object({
  clienteId: z.string().uuid("Selecione um cliente."),
  address_street: z.string().min(1, "Rua é obrigatória."),
  address_number: z.string().min(1, "Número é obrigatório."),
  address_neighborhood: z.string().min(1, "Bairro é obrigatório."),
  address_city: z.string().min(1, "Cidade é obrigatória."),
  address_zip: z.string().optional(),
  address_complement: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "Adicione pelo menos um item ao pedido."),
});

type DeliveryOrderFormProps = {
  clientes: Cliente[];
  produtos: Produto[];
  onSubmit: (values: z.infer<typeof deliveryFormSchema>) => void;
  isSubmitting: boolean;
};

export function DeliveryOrderForm({ clientes, produtos, onSubmit, isSubmitting }: DeliveryOrderFormProps) {
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);

  const form = useForm<z.infer<typeof deliveryFormSchema>>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: {
      items: [],
      clienteId: undefined,
      address_street: "",
      address_number: "",
      address_neighborhood: "",
      address_city: "",
      address_zip: "",
      address_complement: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const selectedClienteId = form.watch("clienteId");

  useEffect(() => {
    if (selectedClienteId) {
      const cliente = clientes.find(c => c.id === selectedClienteId);
      if (cliente) {
        form.setValue("address_street", cliente.address_street || "");
        form.setValue("address_number", cliente.address_number || "");
        form.setValue("address_neighborhood", cliente.address_neighborhood || "");
        form.setValue("address_city", cliente.address_city || "");
        form.setValue("address_zip", cliente.address_zip || "");
        form.setValue("address_complement", cliente.address_complement || "");
      }
    }
  }, [selectedClienteId, clientes, form]);

  const handleAddItem = () => {
    if (selectedProduto) {
      append({
        produtoId: selectedProduto.id,
        nome_produto: selectedProduto.nome,
        quantidade: 1,
        preco: selectedProduto.preco,
        requer_preparo: selectedProduto.requer_preparo,
      });
      setSelectedProduto(null);
    }
  };

  const total = form.watch("items").reduce((acc, item) => acc + item.preco * item.quantidade, 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="clienteId"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Cliente</FormLabel>
              <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                      {field.value ? clientes.find(c => c.id === field.value)?.nome : "Selecione um cliente"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command><CommandInput placeholder="Buscar cliente..." /><CommandList><CommandEmpty>Nenhum cliente encontrado.</CommandEmpty><CommandGroup>
                    {clientes.map((cliente) => (<CommandItem value={cliente.nome} key={cliente.id} onSelect={() => { form.setValue("clienteId", cliente.id); setCustomerPopoverOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", cliente.id === field.value ? "opacity-100" : "opacity-0")} />{cliente.nome}</CommandItem>))}
                  </CommandGroup></CommandList></Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-2 p-4 border rounded-md">
          <h4 className="font-medium">Endereço de Entrega</h4>
          <div className="grid grid-cols-3 gap-2">
            <FormField control={form.control} name="address_street" render={({ field }) => (<FormItem className="col-span-2"><FormControl><Input placeholder="Rua" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="address_number" render={({ field }) => (<FormItem><FormControl><Input placeholder="Nº" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </div>
          <FormField control={form.control} name="address_neighborhood" render={({ field }) => (<FormItem><FormControl><Input placeholder="Bairro" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="address_city" render={({ field }) => (<FormItem><FormControl><Input placeholder="Cidade" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="address_complement" render={({ field }) => (<FormItem><FormControl><Input placeholder="Complemento (opcional)" {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>

        <div className="space-y-2 p-4 border rounded-md">
          <h4 className="font-medium">Itens do Pedido</h4>
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <span className="flex-1">{field.nome_produto}</span>
              <Input type="number" {...form.register(`items.${index}.quantidade`)} className="w-16" />
              <span>x R$ {field.preco.toFixed(2)}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="flex-1 justify-between">
                  {selectedProduto ? selectedProduto.nome : "Selecione um produto para adicionar"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command><CommandInput placeholder="Buscar produto..." /><CommandList><CommandEmpty>Nenhum produto encontrado.</CommandEmpty><CommandGroup>
                  {produtos.map((produto) => (<CommandItem value={produto.nome} key={produto.id} onSelect={() => { setSelectedProduto(produto); setProductPopoverOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", produto.id === selectedProduto?.id ? "opacity-100" : "opacity-0")} />{produto.nome}</CommandItem>))}
                </CommandGroup></CommandList></Command>
              </PopoverContent>
            </Popover>
            <Button type="button" onClick={handleAddItem} disabled={!selectedProduto}><PlusCircle className="w-4 h-4" /></Button>
          </div>
          <FormMessage>{form.formState.errors.items?.message}</FormMessage>
        </div>

        <div className="text-right text-lg font-bold">Total: R$ {total.toFixed(2)}</div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Criando Pedido..." : "Criar Pedido de Delivery"}
        </Button>
      </form>
    </Form>
  );
}