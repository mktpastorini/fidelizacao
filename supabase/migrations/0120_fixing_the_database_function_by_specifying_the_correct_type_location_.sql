CREATE OR REPLACE FUNCTION public.confirm_delivery_order(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_has_items_to_prepare BOOLEAN;
    v_new_status public.delivery_status_enum;
BEGIN
    -- Verificar se existem itens que requerem preparo
    SELECT EXISTS (
        SELECT 1
        FROM public.itens_pedido
        WHERE pedido_id = p_pedido_id
          AND requer_preparo = TRUE
    ) INTO v_has_items_to_prepare;

    -- Determinar o novo status do pedido
    IF v_has_items_to_prepare THEN
        v_new_status := 'in_preparation';
    ELSE
        v_new_status := 'ready_for_delivery';
    END IF;

    -- Atualizar APENAS o status do pedido principal.
    -- Os status dos itens individuais serão gerenciados no Kanban da Cozinha.
    UPDATE public.pedidos
    SET delivery_status = v_new_status
    WHERE id = p_pedido_id;
END;
$$;