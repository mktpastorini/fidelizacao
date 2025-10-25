import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DeliveryOrderForm } from "./DeliveryOrderForm";
import { Cliente, Produto } from "@/types/supabase";
import { Skeleton } from "../ui/skeleton";
import { showError, showSuccess } from "@/utils/toast";

type NewDeliveryOrderDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

async function fetchDialogData(): Promise<{ clientes: Cliente[], produtos: Produto[] }> {
  const { data: clientes, error: clientesError } = await supabase.from("clientes").select("*").order("nome");
  if (clientesError) throw new Error(clientesError.message);

  const { data: produtos, error: produtosError } = await supabase.from("produtos").select("*").order("nome");
  if (produtosError) throw new Error(produtosError.message);

  return { clientes: clientes || [], produtos: produtos || [] };
}

export function NewDeliveryOrderDialog({
  isOpen,
  onOpenChange,
}: NewDeliveryOrderDialogProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["newDeliveryOrderData"],
    queryFn: fetchDialogData,
    enabled: isOpen,
  });

  const createDeliveryOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const deliveryDetails = {
        customer: { name: data?.clientes?.find(c => c.id === values.clienteId)?.nome },
        delivery: {
          deliveryAddress: {
            streetName: values.address_street,
            streetNumber: values.address_number,
            neighborhood: values.address_neighborhood,
            city: values.address_city,
            postalCode: values.address_zip,
            complement: values.address_complement,
          },
        },
        channel: values.channel,
      };

      const { data: newPedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          user_id: user.id,
          cliente_id: values.clienteId,
          order_type: 'DELIVERY',
          delivery_status: 'awaiting_confirmation',
          status: 'aberto',
          delivery_details: deliveryDetails,
        })
        .select('id')
        .single();
      
      if (pedidoError) throw pedidoError;

      const orderItems = values.items.map((item: any) => ({
        pedido_id: newPedido.id,
        user_id: user.id,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade,
        preco: item.preco,
        status: 'pendente',
        requer_preparo: item.requer_preparo,
        consumido_por_cliente_id: values.clienteId,
      }));

      const { error: itemsError } = await supabase.from('itens_pedido').insert(orderItems);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeDeliveryOrders"] });
      queryClient.invalidateQueries({ queryKey: ["deliveryKitchenItems"] });
      showSuccess("Novo pedido de delivery criado com sucesso!");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      showError(`Falha ao criar pedido: ${error.message}`);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Pedido de Delivery</DialogTitle>
          <DialogDescription>
            Selecione o cliente, confirme o endereço e adicione os itens.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <DeliveryOrderForm
              clientes={data?.clientes || []}
              produtos={data?.produtos || []}
              onSubmit={createDeliveryOrderMutation.mutate}
              isSubmitting={createDeliveryOrderMutation.isPending}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}