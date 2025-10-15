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
import { Input } from "@/components/ui/input";
import { ItemPedido } from "@/types/supabase";

const formSchema = z.object({
  desconto_percentual: z.coerce.number().min(0, "O desconto não pode ser negativo.").max(100, "O desconto não pode ser maior que 100%.").default(0),
  desconto_motivo: z.string().optional(),
});

type AplicarDescontoDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: ItemPedido | null;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
};

export function AplicarDescontoDialog({
  isOpen,
  onOpenChange,
  item,
  onSubmit,
  isSubmitting,
}: AplicarDescontoDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      desconto_percentual: item?.desconto_percentual || 0,
      desconto_motivo: item?.desconto_motivo || "",
    },
  });

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar Desconto</DialogTitle>
          <DialogDescription>
            Aplicando desconto para o item: {item.nome_produto} (x{item.quantidade})
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="desconto_percentual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desconto (%)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 15" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="desconto_motivo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Aniversariante, Bariátrica" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Aplicar Desconto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}