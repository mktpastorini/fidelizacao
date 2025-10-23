CREATE OR REPLACE FUNCTION public.finalizar_pagamento_parcial(p_pedido_id uuid, p_cliente_id_pagando uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_mesa_id uuid;
    new_pedido_id uuid;
    remaining_items_count integer;
    v_acompanhantes_originais jsonb;
BEGIN
    -- 1. Obter informações do pedido original, incluindo a lista de acompanhantes original
    SELECT user_id, mesa_id, acompanhantes INTO v_user_id, v_mesa_id, v_acompanhantes_originais
    FROM public.pedidos
    WHERE id = p_pedido_id AND user_id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Pedido não encontrado ou não pertence ao usuário.';
    END IF;

    -- 2. Criar um novo pedido "recibo" para o cliente que está pagando, usando a lista original de acompanhantes
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, mesa_id, acompanhantes)
    VALUES (v_user_id, p_cliente_id_pagando, 'pago', now(), v_mesa_id, v_acompanhantes_originais)
    RETURNING id INTO new_pedido_id;

    -- 3. Mover os itens do cliente para o novo pedido "recibo"
    UPDATE public.itens_pedido
    SET pedido_id = new_pedido_id
    WHERE pedido_id = p_pedido_id AND consumido_por_cliente_id = p_cliente_id_pagando;

    -- 4. Remover o cliente da lista de ocupantes da mesa (lógica de ocupação atual)
    DELETE FROM public.mesa_ocupantes
    WHERE mesa_id = v_mesa_id AND cliente_id = p_cliente_id_pagando;

    -- 5. Verificar se o pedido original ainda tem itens
    SELECT COUNT(*) INTO remaining_items_count
    FROM public.itens_pedido
    WHERE pedido_id = p_pedido_id;

    -- 6. Se o pedido original estiver vazio, fechar a mesa e salvar os acompanhantes originais
    IF remaining_items_count = 0 THEN
        UPDATE public.pedidos
        SET status = 'pago', closed_at = now(), acompanhantes = v_acompanhantes_originais
        WHERE id = p_pedido_id;

        UPDATE public.mesas
        SET cliente_id = NULL
        WHERE id = v_mesa_id;
    END IF;
END;
$function$