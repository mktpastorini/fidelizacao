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

    -- 2. Obter o ID do usuário logado (necessário para o novo pedido de recibo)
    SELECT auth.uid() INTO v_user_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- 3. Criar um novo pedido "recibo" (status 'pago') para o cliente principal
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, mesa_id, acompanhantes)
    VALUES (v_user_id, v_cliente_id, 'pago', NOW(), p_mesa_id, v_acompanhantes)
    RETURNING id INTO v_new_pedido_id;

    -- 4. Mover todos os itens restantes (Mesa Geral) para o novo pedido de recibo
    UPDATE public.itens_pedido
    SET 
        pedido_id = v_new_pedido_id,
        consumido_por_cliente_id = v_cliente_id, -- Atribui ao cliente principal
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