CREATE OR REPLACE FUNCTION public.handle_delivery_item_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_pedido_id UUID;
    v_order_type TEXT;
    v_is_ready BOOLEAN;
BEGIN
    -- Obtém o ID e o tipo do pedido associado
    SELECT id, order_type INTO v_pedido_id, v_order_type
    FROM public.pedidos
    WHERE id = NEW.pedido_id;

    -- Só continua se for um pedido de IFOOD ou DELIVERY
    IF v_order_type IN ('IFOOD', 'DELIVERY') THEN
        
        -- NOVO: Se um item entra em preparo, atualiza o pedido principal
        IF NEW.status = 'preparando' AND OLD.status = 'pendente' THEN
            UPDATE public.pedidos
            SET delivery_status = 'in_preparation'
            WHERE id = v_pedido_id AND delivery_status = 'CONFIRMED';
        END IF;

        -- Se um item é entregue, verifica se o pedido todo está pronto
        IF NEW.status = 'entregue' AND OLD.status <> 'entregue' THEN
            SELECT public.check_delivery_order_readiness(v_pedido_id) INTO v_is_ready;

            IF v_is_ready THEN
                UPDATE public.pedidos
                SET delivery_status = 'ready_for_delivery'
                WHERE id = v_pedido_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$