import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { MessageTemplate, Cliente } from "@/types/supabase";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  template_id: z.string({ required_error: "Por favor, selecione um template." }),
  client_ids: z.array(z.string()).min(1, "Selecione pelo menos um cliente."),
});

type SendBulkMessageDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  templates: MessageTemplate[];
  clientes: Cliente[];
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
};

export function SendBulkMessageDialog({
  isOpen,
  onOpenChange,
  templates,
  clientes,
  onSubmit,
  isSubmitting,
}: SendBulkMessageDialogProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { client_ids: [] },
  });

  const selectedClients = form.watch("client_ids");

  const handleSelectAll = () => {
    const allClientIds = clientes.map(c => c.id);
    form.setValue("client_ids", allClientIds, { shouldValidate: true });
  };

  const handleClearAll = () => {
    form.setValue("client_ids", [], { shouldValidate: true });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem Manual</DialogTitle>
          <DialogDescription>
            Selecione um template e os clientes que receberão a mensagem.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="template_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template da Mensagem</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client_ids"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Destinatários</FormLabel>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            selectedClients.length === 0 && "text-muted-foreground"
                          )}
                        >
                          {selectedClients.length > 0
                            ? `${selectedClients.length} cliente(s) selecionado(s)`
                            : "Selecione os clientes"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {clientes.map((cliente) => (
                              <CommandItem
                                value={cliente.nome}
                                key={cliente.id}
                                onSelect={() => {
                                  const currentIds = field.value || [];
                                  const newIds = currentIds.includes(cliente.id)
                                    ? currentIds.filter((id) => id !== cliente.id)
                                    : [...currentIds, cliente.id];
                                  form.setValue("client_ids", newIds, { shouldValidate: true });
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value?.includes(cliente.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {cliente.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="flex items-center gap-2 mt-2">
                    <Button type="button" variant="link" size="sm" className="p-0 h-auto" onClick={handleSelectAll}>Selecionar Todos</Button>
                    <Button type="button" variant="link" size="sm" className="p-0 h-auto text-destructive" onClick={handleClearAll}>Limpar Seleção</Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : `Enviar para ${selectedClients.length} cliente(s)`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}