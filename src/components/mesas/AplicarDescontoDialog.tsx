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
import { useApprovalRequest } from "@/hooks/useApprovalRequest"; // Importado

const formSchema = z.object({
  desconto_percentual: z.coerce.number().min(0, "O desconto não pode ser negativo.").max(100, "O desconto não pode ser maior que 100%.").default(0),
  desconto_motivo: z.string().optional(),
});

type AplicarDescontoDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: ItemPedido | null;
  onDiscountRequested: () => void; // Nova prop para fechar o modal pai
};

export function AplicarDescontoDialog({
  isOpen,
  onOpenChange,
  item,
  onDiscountRequested,
}: AplicarDescontoDialogProps) {
  const { requestApproval, isRequesting } = useApprovalRequest();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      desconto_percentual: item?.desconto_percentual || 0,
      desconto_motivo: item?.desconto_motivo || "",
    },
  });

  if (!item) return null;

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    const request = {
      action_type: 'apply_discount' as const,
      target_id: item.id,
      payload: {
        desconto_percentual: values.desconto_percentual,
        desconto_motivo: values.desconto_motivo,
        item_nome: item.nome_produto,
      },
    };

    const executed = await requestApproval(request);
    
    if (executed) {
      // Se executado diretamente (Admin/Gerente), fecha o modal
      onOpenChange(false);
      onDiscountRequested(); // Notifica o pai para invalidar queries
    } else if (isRequesting) {
      // Se a solicitação foi enviada (Garçom/Balcão), fecha o modal
      onOpenChange(false);
    }
  };

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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
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
              <Button type="submit" disabled={isRequesting}>
                {isRequesting ? "Solicitando..." : "Aplicar Desconto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}