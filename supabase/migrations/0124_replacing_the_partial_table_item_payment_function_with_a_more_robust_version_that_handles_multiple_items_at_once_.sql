-- Drop the old, limited function
DROP FUNCTION IF EXISTS public.finalizar_pagamento_item_mesa(uuid, uuid, integer, uuid, numeric, uuid);

-- Create a new, more capable function to handle partial payments of multiple items
CREATE OR REPLACE FUNCTION public.finalizar_pagamento_itens_parciais(
    p_pedido_id uuid,
    p_cliente_id uuid,
    p_itens_a_pagar jsonb, -- e.g., '[{"item_id": "...", "quantidade": 1}, {"item_id": "...", "quantidade": 2}]'
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
    item_record RECORD;
    v_original_item RECORD;
    v_acompanhantes_json jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Get companions list for the receipt
    SELECT acompanhantes INTO v_acompanhantes_json FROM public.pedidos WHERE id = p_pedido_id;

    -- 1. Create a new "receipt" order for the paying client
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, garcom_id, gorjeta_valor, mesa_id, acompanhantes)
    VALUES (v_user_id, p_cliente_id, 'pago', NOW(), p_garcom_id, p_gorjeta_valor, (SELECT mesa_id FROM public.pedidos WHERE id = p_pedido_id), v_acompanhantes_json)
    RETURNING id INTO v_new_pedido_id;

    -- 2. Process each item to be paid
    FOR item_record IN
        SELECT * FROM jsonb_to_recordset(p_itens_a_pagar) AS x(item_id uuid, quantidade integer)
    LOOP
        -- Fetch the original item
        SELECT * INTO v_original_item FROM public.itens_pedido WHERE id = item_record.item_id AND pedido_id = p_pedido_id;

        IF NOT FOUND THEN
            RAISE WARNING 'Item de pedido % não encontrado no pedido aberto. Pulando.', item_record.item_id;
            CONTINUE;
        END IF;

        IF item_record.quantidade > v_original_item.quantidade THEN
            RAISE EXCEPTION 'Quantidade a pagar (%) excede a quantidade restante (%) para o item %.', item_record.quantidade, v_original_item.quantidade, v_original_item.nome_produto;
        END IF;

        IF item_record.quantidade = v_original_item.quantidade THEN
            -- Move the entire item to the new receipt order
            UPDATE public.itens_pedido
            SET 
                pedido_id = v_new_pedido_id,
                consumido_por_cliente_id = COALESCE(v_original_item.consumido_por_cliente_id, p_cliente_id),
                updated_at = NOW()
            WHERE id = item_record.item_id;
        ELSE
            -- Split the item:
            -- a) Update the remaining quantity in the original order
            UPDATE public.itens_pedido
            SET quantidade = v_original_item.quantidade - item_record.quantidade
            WHERE id = item_record.item_id;

            -- b) Insert the paid portion into the new receipt order
            INSERT INTO public.itens_pedido (
                pedido_id, user_id, nome_produto, preco, quantidade, 
                consumido_por_cliente_id, desconto_percentual, desconto_motivo, 
                status, requer_preparo, cozinheiro_id, hora_inicio_preparo, hora_entrega
            )
            VALUES (
                v_new_pedido_id, v_user_id, v_original_item.nome_produto, v_original_item.preco, item_record.quantidade,
                COALESCE(v_original_item.consumido_por_cliente_id, p_cliente_id), 
                v_original_item.desconto_percentual, v_original_item.desconto_motivo,
                v_original_item.status, v_original_item.requer_preparo, v_original_item.cozinheiro_id, 
                v_original_item.hora_inicio_preparo, v_original_item.hora_entrega
            );
        END IF;
    END LOOP;

    -- The handle_pedido_pago_points trigger will handle adding points.

    RETURN QUERY SELECT 'Pagamento parcial processado com sucesso.' AS message;
END;
$$;