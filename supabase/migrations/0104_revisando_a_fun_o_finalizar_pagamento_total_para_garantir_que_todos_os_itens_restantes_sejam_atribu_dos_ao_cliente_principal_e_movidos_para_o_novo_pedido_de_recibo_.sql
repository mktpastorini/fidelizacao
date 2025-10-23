CREATE OR REPLACE FUNCTION public.finalizar_pagamento_total(p_pedido_id uuid, p_mesa_id uuid)
 RETURNS TABLE(message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_cliente_id uuid;
    v_acompanhantes jsonb;
    v_new_pedido_id uuid;
    v_total_items_remaining integer;
BEGIN
    -- 1. Obter informações essenciais do pedido aberto
    SELECT cliente_id, acompanhantes
    INTO v_cliente_id, v_acompanhantes
    FROM public.pedidos
    WHERE id = p_pedido_id AND status = 'aberto';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido aberto não encontrado para o ID especificado (%).', p_pedido_id;
    END IF;

    -- Se o pedido não tem cliente principal, usamos o cliente da mesa (se houver) ou levantamos exceção
    IF v_cliente_id IS NULL THEN
        SELECT cliente_id INTO v_cliente_id FROM public.mesas WHERE id = p_mesa_id;
        IF v_cliente_id IS NULL THEN
            RAISE EXCEPTION 'Não é possível finalizar a conta total: O pedido não tem cliente principal e a mesa está desocupada.';
        END IF;
    END IF;

    -- 2. Obter o ID do usuário logado
    SELECT auth.uid() INTO v_user_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- 3. Criar um novo pedido "recibo" (status 'pago') para o cliente principal
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, mesa_id, acompanhantes)
    VALUES (v_user_id, v_cliente_id, 'pago', NOW(), p_mesa_id, v_acompanhantes)
    RETURNING id INTO v_new_pedido_id;

    -- 4. Mover TODOS os itens restantes do pedido original para o novo pedido de recibo
    -- E atribuir o consumido_por_cliente_id ao cliente principal (v_cliente_id) se for nulo (Mesa Geral)
    UPDATE public.itens_pedido
    SET 
        pedido_id = v_new_pedido_id,
        consumido_por_cliente_id = COALESCE(consumido_por_cliente_id, v_cliente_id), -- Atribui Mesa Geral ao cliente principal
        updated_at = NOW()
    WHERE pedido_id = p_pedido_id;

    -- 5. Fechar o pedido original (que agora está vazio)
    UPDATE public.pedidos
    SET status = 'pago', closed_at = NOW()
    WHERE id = p_pedido_id;

    -- 6. Liberar a mesa (remove cliente_id e todos os ocupantes)
    UPDATE public.mesas
    SET cliente_id = NULL
    WHERE id = p_mesa_id;

    DELETE FROM public.mesa_ocupantes
    WHERE mesa_id = p_mesa_id;

    RETURN QUERY SELECT 'Conta total finalizada e mesa liberada.' AS message;
END;
$function$;