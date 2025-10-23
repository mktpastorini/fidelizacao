CREATE OR REPLACE FUNCTION public.process_free_table_request(p_request_id uuid, p_approved_by uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_mesa_id UUID;
    v_open_order_id UUID;
    v_cancelled_items JSONB := '[]'::jsonb;
    v_occupants_json JSONB := '[]'::jsonb; -- Inicializado como array vazio
    v_mesa_numero INTEGER;
    v_can_be_freed BOOLEAN;
    v_cliente_principal_id UUID;
    v_acompanhantes_raw JSONB; -- Variável temporária para a coluna acompanhantes
BEGIN
    -- 1. Buscar a solicitação pendente
    SELECT target_id, payload->>'mesa_numero' INTO v_mesa_id, v_mesa_numero
    FROM public.approval_requests
    WHERE id = p_request_id AND status = 'pending' AND action_type = 'free_table';

    IF v_mesa_id IS NULL THEN
        RAISE EXCEPTION 'Solicitação não encontrada ou já processada.';
    END IF;

    -- 2. Verificar se a mesa pode ser liberada (se não houver itens em preparo)
    SELECT public.check_mesa_can_be_freed(v_mesa_id) INTO v_can_be_freed;

    IF NOT v_can_be_freed THEN
        RAISE EXCEPTION 'Mesa % não pode ser liberada: existem itens em preparo.', v_mesa_numero;
    END IF;

    -- 3. Tenta encontrar o pedido aberto e o cliente principal
    SELECT id, cliente_id, acompanhantes INTO v_open_order_id, v_cliente_principal_id, v_acompanhantes_raw
    FROM public.pedidos
    WHERE mesa_id = v_mesa_id AND status = 'aberto'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se o pedido foi encontrado, atualiza a lista de ocupantes para o payload de auditoria
    IF v_open_order_id IS NOT NULL THEN
        v_occupants_json := COALESCE(v_acompanhantes_raw, '[]'::jsonb); -- Garante que é um array JSONB
        
        -- 4. Cancelar itens pendentes do cliente principal (se houver um cliente principal no pedido)
        IF v_cliente_principal_id IS NOT NULL THEN
            WITH pending_items AS (
                SELECT id, nome_produto, quantidade, preco, desconto_percentual, desconto_motivo
                FROM public.itens_pedido
                WHERE pedido_id = v_open_order_id
                  AND status = 'pendente'
                  AND consumido_por_cliente_id = v_cliente_principal_id
            )
            -- Coletar itens cancelados para o payload
            SELECT jsonb_agg(row_to_json(pi)) INTO v_cancelled_items FROM pending_items pi;

            -- Se jsonb_agg retornou NULL (nenhum item), inicializa como array vazio
            v_cancelled_items := COALESCE(v_cancelled_items, '[]'::jsonb);

            -- Atualizar status dos itens pendentes para 'cancelado'
            UPDATE public.itens_pedido
            SET status = 'cancelado'
            WHERE id IN (SELECT id FROM pending_items);
        END IF;

        -- 5. Verificar se restaram itens no pedido (itens da mesa geral ou de acompanhantes)
        PERFORM 1 FROM public.itens_pedido WHERE pedido_id = v_open_order_id LIMIT 1;

        IF NOT FOUND THEN
            -- Se não restou nada, cancela o pedido principal
            UPDATE public.pedidos SET status = 'cancelado', closed_at = NOW() WHERE id = v_open_order_id;
        END IF;
    END IF;

    -- 6. Libera a mesa e remove ocupantes
    UPDATE public.mesas SET cliente_id = NULL WHERE id = v_mesa_id;
    DELETE FROM public.mesa_ocupantes WHERE mesa_id = v_mesa_id;

    -- 7. Atualizar a solicitação como aprovada, incluindo a lista de ocupantes no payload para auditoria
    UPDATE public.approval_requests
    SET 
        status = 'approved', 
        approved_by = p_approved_by, 
        approved_at = NOW(),
        payload = jsonb_set(
            jsonb_set(payload, '{cancelled_items}', v_cancelled_items),
            '{occupants_at_cancellation}', v_occupants_json
        )
    WHERE id = p_request_id;

    RETURN json_build_object('success', TRUE, 'message', 'Mesa liberada e itens pendentes do cliente principal cancelados.');
END;
$function$;