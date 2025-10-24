CREATE OR REPLACE FUNCTION public.confirm_delivery_order(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_has_items_to_prepare BOOLEAN;
BEGIN
    -- 1. Check if there are any items that require preparation
    SELECT EXISTS (
        SELECT 1
        FROM public.itens_pedido
        WHERE pedido_id = p_pedido_id
          AND requer_preparo = TRUE
          AND status = 'pendente'
    ) INTO v_has_items_to_prepare;

    -- 2. Based on the check, update the main order and its items
    IF v_has_items_to_prepare THEN
        -- Order has items for the kitchen
        
        -- a) Set the main order status to 'in_preparation'
        UPDATE public.pedidos
        SET delivery_status = 'in_preparation'
        WHERE id = p_pedido_id;

        -- b) Set items that need prep to 'preparando'
        UPDATE public.itens_pedido
        SET status = 'preparando'
        WHERE pedido_id = p_pedido_id
          AND requer_preparo = TRUE
          AND status = 'pendente';
          
        -- c) Set items that DON'T need prep (like drinks) directly to 'entregue'
        UPDATE public.itens_pedido
        SET status = 'entregue'
        WHERE pedido_id = p_pedido_id
          AND requer_preparo = FALSE
          AND status = 'pendente';

    ELSE
        -- Order has NO items for the kitchen (e.g., only drinks)
        
        -- a) Set the main order status directly to 'ready_for_delivery'
        UPDATE public.pedidos
        SET delivery_status = 'ready_for_delivery'
        WHERE id = p_pedido_id;

        -- b) Set all items to 'entregue' since none require prep
        UPDATE public.itens_pedido
        SET status = 'entregue'
        WHERE pedido_id = p_pedido_id
          AND status = 'pendente';
    END IF;
END;
$$;