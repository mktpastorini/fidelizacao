CREATE OR REPLACE FUNCTION public.finalizar_pagamento_parcial(
    p_pedido_id uuid,
    p_cliente_id uuid,
    p_item_ids_to_pay jsonb,
    p_gorjeta_valor numeric,
    p_garcom_id uuid
)
RETURNS TABLE(message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_new_pedido_id uuid;
    item_record RECORD;
    v_item_id uuid;
    v_quantidade_a_pagar integer;
    v_is_mesa_item boolean;
    v_original_item RECORD;
    v_total_items_remaining integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- 1. Criar um novo pedido "recibo" (status 'pago') para o cliente
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, garcom_id, gorjeta_valor)
    VALUES (v_user_id, p_cliente_id, 'pago', NOW(), p_garcom_id, p_gorjeta_valor)
    RETURNING id INTO v_new_pedido_id;

    -- 2. Processar cada item a ser pago
    FOR item_record IN
        SELECT * FROM jsonb_array_elements(p_item_ids_to_pay) AS item
    LOOP
        v_item_id := (item_record.item->>'id')::uuid;
        v_quantidade_a_pagar := (item_record.item->>'quantidade')::integer;
        v_is_mesa_item := (item_record.item->>'isMesaItem')::boolean;

        -- Buscar o item original
        SELECT * INTO v_original_item FROM public.itens_pedido WHERE id = v_item_id AND pedido_id = p_pedido_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Item de pedido % não encontrado no pedido aberto.', v_item_id;
        END IF;

        IF v_quantidade_a_pagar > v_original_item.quantidade THEN
            RAISE EXCEPTION 'Quantidade a pagar (%) excede a quantidade restante (%) para o item %.', v_quantidade_a_pagar, v_original_item.quantidade, v_original_item.nome_produto;
        END IF;

        IF v_quantidade_a_pagar = v_original_item.quantidade THEN
            -- Mover o item inteiro para o novo pedido de recibo
            UPDATE public.itens_pedido
            SET 
                pedido_id = v_new_pedido_id,
                consumido_por_cliente_id = COALESCE(v_original_item.consumido_por_cliente_id, p_cliente_id), -- Atribui ao cliente se for Mesa Geral
                updated_at = NOW()
            WHERE id = v_item_id;
        ELSE
            -- Dividir o item:
            -- a) Atualizar a quantidade restante no pedido original
            UPDATE public.itens_pedido
            SET quantidade = v_original_item.quantidade - v_quantidade_a_pagar
            WHERE id = v_item_id;

            -- b) Inserir o item pago no novo pedido de recibo
            INSERT INTO public.itens_pedido (
                pedido_id, user_id, nome_produto, preco, quantidade, 
                consumido_por_cliente_id, desconto_percentual, desconto_motivo, 
                status, requer_preparo, cozinheiro_id, hora_inicio_preparo, hora_entrega
            )
            VALUES (
                v_new_pedido_id, v_user_id, v_original_item.nome_produto, v_original_item.preco, v_quantidade_a_pagar,
                COALESCE(v_original_item.consumido_por_cliente_id, p_cliente_id), v_original_item.desconto_percentual, v_original_item.desconto_motivo,
                v_original_item.status, v_original_item.requer_preparo, v_original_item.cozinheiro_id, v_original_item.hora_inicio_preparo, v_original_item.hora_entrega
            );
        END IF;
    END LOOP;

    -- 3. Verificar se restaram itens no pedido original
    SELECT COUNT(*) INTO v_total_items_remaining FROM public.itens_pedido WHERE pedido_id = p_pedido_id;

    IF v_total_items_remaining = 0 THEN
        -- Se não restou nada, cancela o pedido principal (que agora está vazio)
        UPDATE public.pedidos
        SET status = 'cancelado', closed_at = NOW()
        WHERE id = p_pedido_id;
    END IF;

    -- 4. O trigger handle_pedido_pago_points cuidará da adição de pontos ao cliente (p_cliente_id)

    RETURN QUERY SELECT 'Pagamento parcial finalizado e recibo gerado.' AS message;
END;
$function$;