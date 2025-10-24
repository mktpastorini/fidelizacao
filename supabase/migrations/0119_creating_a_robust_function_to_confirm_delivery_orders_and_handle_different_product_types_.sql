CREATE OR REPLACE FUNCTION public.confirm_delivery_order(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_has_items_to_prepare BOOLEAN;
BEGIN
    -- Verificar se existem itens pendentes que requerem preparo
    SELECT EXISTS (
        SELECT 1
        FROM public.itens_pedido
        WHERE pedido_id = p_pedido_id
          AND requer_preparo = TRUE
          AND status = 'pendente'
    ) INTO v_has_items_to_prepare;

    -- Se houver itens para preparar
    IF v_has_items_to_prepare THEN
        -- Mover o pedido para 'Em Preparo'
        UPDATE public.pedidos
        SET delivery_status = 'in_preparation'
        WHERE id = p_pedido_id;

        -- Mover itens sem preparo para 'Entregue'
        UPDATE public.itens_pedido
        SET status = 'entregue'
        WHERE pedido_id = p_pedido_id
          AND status = 'pendente'
          AND requer_preparo = FALSE;

        -- Mover itens com preparo para 'Preparando'
        UPDATE public.itens_pedido
        SET status = 'preparando'
        WHERE pedido_id = p_pedido_id
          AND status = 'pendente'
          AND requer_preparo = TRUE;
    -- Se NÃO houver itens para preparar
    ELSE
        -- Mover o pedido diretamente para 'Pronto para Entrega'
        UPDATE public.pedidos
        SET delivery_status = 'ready_for_delivery'
        WHERE id = p_pedido_id;

        -- Mover todos os itens (que por definição não requerem preparo) para 'Entregue'
        UPDATE public.itens_pedido
        SET status = 'entregue'
        WHERE pedido_id = p_pedido_id
          AND status = 'pendente';
    END IF;
END;
$$;