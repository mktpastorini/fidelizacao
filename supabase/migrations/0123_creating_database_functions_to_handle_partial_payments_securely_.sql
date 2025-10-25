-- Function to finalize payment for all of a single client's items
CREATE OR REPLACE FUNCTION public.finalizar_pagamento_parcial_cliente(
    p_pedido_id uuid,
    p_cliente_id uuid,
    p_gorjeta_valor numeric,
    p_garcom_id uuid
)
RETURNS TABLE(message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_new_pedido_id uuid;
    v_items_to_pay_count integer;
    v_acompanhantes_json jsonb;
    v_mesa_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Get mesa_id from the original order
    SELECT mesa_id, acompanhantes INTO v_mesa_id, v_acompanhantes_json FROM public.pedidos WHERE id = p_pedido_id;
    IF v_mesa_id IS NULL THEN
        RAISE EXCEPTION 'Pedido não está associado a uma mesa.';
    END IF;

    -- Verify there are items for this client
    SELECT count(*) INTO v_items_to_pay_count
    FROM public.itens_pedido
    WHERE pedido_id = p_pedido_id AND consumido_por_cliente_id = p_cliente_id;

    IF v_items_to_pay_count = 0 THEN
        RAISE EXCEPTION 'Nenhum item individual encontrado para este cliente no pedido.';
    END IF;

    -- 1. Create a new "receipt" order (status 'pago') for the client
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, garcom_id, gorjeta_valor, mesa_id, acompanhantes)
    VALUES (v_user_id, p_cliente_id, 'pago', NOW(), p_garcom_id, p_gorjeta_valor, v_mesa_id, v_acompanhantes_json)
    RETURNING id INTO v_new_pedido_id;

    -- 2. Move all of the client's items to the new receipt order
    UPDATE public.itens_pedido
    SET pedido_id = v_new_pedido_id, updated_at = NOW()
    WHERE pedido_id = p_pedido_id AND consumido_por_cliente_id = p_cliente_id;

    -- 3. Remove the client from the table occupants
    DELETE FROM public.mesa_ocupantes
    WHERE mesa_id = v_mesa_id AND cliente_id = p_cliente_id;

    -- 4. Update the main order's 'acompanhantes' JSON array
    UPDATE public.pedidos
    SET acompanhantes = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(acompanhantes) AS elem
        WHERE (elem->>'id')::uuid <> p_cliente_id
    )
    WHERE id = p_pedido_id;

    -- 5. Check if the original order/table should be closed
    DECLARE
        v_total_items_remaining integer;
        v_total_occupants_remaining integer;
    BEGIN
        SELECT COUNT(*) INTO v_total_items_remaining FROM public.itens_pedido WHERE pedido_id = p_pedido_id;
        SELECT COUNT(*) INTO v_total_occupants_remaining FROM public.mesa_ocupantes WHERE mesa_id = v_mesa_id;

        IF v_total_items_remaining = 0 THEN
            -- If no items are left, close the main order and free the table
            UPDATE public.pedidos SET status = 'pago', closed_at = NOW() WHERE id = p_pedido_id;
            UPDATE public.mesas SET cliente_id = NULL WHERE id = v_mesa_id;
        ELSIF v_total_occupants_remaining = 0 THEN
             -- If no occupants are left, free the table but keep the order open (for general table items)
             UPDATE public.mesas SET cliente_id = NULL WHERE id = v_mesa_id;
        END IF;
    END;

    -- The handle_pedido_pago_points trigger will handle adding points.

    RETURN QUERY SELECT 'Pagamento individual finalizado com sucesso.' AS message;
END;
$$;

-- Function to pay for a specific quantity of a "Mesa (Geral)" item
CREATE OR REPLACE FUNCTION public.finalizar_pagamento_item_mesa(
    p_pedido_id uuid,
    p_item_id uuid, -- ID of the original item to be paid
    p_quantidade_a_pagar integer,
    p_cliente_id uuid, -- Client who is paying
    p_gorjeta_valor numeric,
    p_garcom_id uuid
)
RETURNS TABLE(message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_new_pedido_id uuid;
    v_original_item RECORD;
    v_acompanhantes_json jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Fetch the original item
    SELECT * INTO v_original_item FROM public.itens_pedido WHERE id = p_item_id AND pedido_id = p_pedido_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de pedido % não encontrado no pedido aberto.', p_item_id;
    END IF;
    
    IF v_original_item.consumido_por_cliente_id IS NOT NULL THEN
        RAISE EXCEPTION 'Este item já pertence a um cliente individual e não pode ser pago separadamente.';
    END IF;

    IF p_quantidade_a_pagar > v_original_item.quantidade THEN
        RAISE EXCEPTION 'Quantidade a pagar (%) excede a quantidade restante (%) para o item %.', p_quantidade_a_pagar, v_original_item.quantidade, v_original_item.nome_produto;
    END IF;
    
    -- Get the list of companions from the original order for the receipt
    SELECT acompanhantes INTO v_acompanhantes_json FROM public.pedidos WHERE id = p_pedido_id;

    -- 1. Create a new "receipt" order (status 'pago') for the client
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, garcom_id, gorjeta_valor, mesa_id, acompanhantes)
    VALUES (v_user_id, p_cliente_id, 'pago', NOW(), p_garcom_id, p_gorjeta_valor, (SELECT mesa_id FROM public.pedidos WHERE id = p_pedido_id), v_acompanhantes_json)
    RETURNING id INTO v_new_pedido_id;

    -- 2. Process the item
    IF p_quantidade_a_pagar = v_original_item.quantidade THEN
        -- Move the entire item to the new receipt order, assigning it to the client
        UPDATE public.itens_pedido
        SET 
            pedido_id = v_new_pedido_id,
            consumido_por_cliente_id = p_cliente_id,
            updated_at = NOW()
        WHERE id = p_item_id;
    ELSE
        -- Split the item:
        -- a) Update the remaining quantity in the original order
        UPDATE public.itens_pedido
        SET quantidade = v_original_item.quantidade - p_quantidade_a_pagar
        WHERE id = p_item_id;

        -- b) Insert the paid item into the new receipt order
        INSERT INTO public.itens_pedido (
            pedido_id, user_id, nome_produto, preco, quantidade, 
            consumido_por_cliente_id, desconto_percentual, desconto_motivo, 
            status, requer_preparo, cozinheiro_id, hora_inicio_preparo, hora_entrega
        )
        VALUES (
            v_new_pedido_id, v_user_id, v_original_item.nome_produto, v_original_item.preco, p_quantidade_a_pagar,
            p_cliente_id, v_original_item.desconto_percentual, v_original_item.desconto_motivo,
            v_original_item.status, v_original_item.requer_preparo, v_original_item.cozinheiro_id, v_original_item.hora_inicio_preparo, v_original_item.hora_entrega
        );
    END IF;

    -- The handle_pedido_pago_points trigger will handle adding points.

    RETURN QUERY SELECT 'Pagamento de item da mesa atribuído com sucesso.' AS message;
END;
$$;