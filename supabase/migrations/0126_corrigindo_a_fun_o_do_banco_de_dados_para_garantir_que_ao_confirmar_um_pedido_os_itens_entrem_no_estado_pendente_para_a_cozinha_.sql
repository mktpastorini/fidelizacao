CREATE OR REPLACE FUNCTION public.confirm_delivery_order(p_pedido_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    -- 1. Atualiza o status do pedido principal para 'CONFIRMED'.
    -- Os itens que requerem preparo permanecerão como 'pendente' para a cozinha.
    UPDATE public.pedidos
    SET delivery_status = 'CONFIRMED'
    WHERE id = p_pedido_id;

    -- 2. Itens que NÃO requerem preparo (ex: bebidas) são marcados como 'entregue' imediatamente.
    -- Isso remove a carga da cozinha e do garçom para esses itens.
    UPDATE public.itens_pedido
    SET status = 'entregue'
    WHERE pedido_id = p_pedido_id
      AND requer_preparo = FALSE
      AND status = 'pendente';
END;
$function$