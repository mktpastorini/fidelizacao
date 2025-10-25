CREATE OR REPLACE FUNCTION public.confirm_delivery_order(p_pedido_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_is_ready BOOLEAN;
BEGIN
    -- 1. Atualiza o status do pedido principal para 'CONFIRMED'.
    UPDATE public.pedidos
    SET delivery_status = 'CONFIRMED'
    WHERE id = p_pedido_id;

    -- 2. Itens que NÃO requerem preparo são marcados como 'entregue' imediatamente.
    UPDATE public.itens_pedido
    SET status = 'entregue'
    WHERE pedido_id = p_pedido_id
      AND requer_preparo = FALSE
      AND status = 'pendente';

    -- 3. APÓS a atualização, verifica se TODOS os itens já estão prontos.
    -- Isso acontece se o pedido continha apenas itens de venda direta.
    SELECT public.check_delivery_order_readiness(p_pedido_id) INTO v_is_ready;

    -- 4. Se todos os itens estiverem prontos, atualiza o status do pedido principal para 'ready_for_delivery'.
    IF v_is_ready THEN
        UPDATE public.pedidos
        SET delivery_status = 'ready_for_delivery'
        WHERE id = p_pedido_id;
    END IF;
END;
$function$