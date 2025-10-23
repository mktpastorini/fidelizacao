CREATE OR REPLACE FUNCTION public.finalizar_pagamento_total(p_pedido_id uuid, p_mesa_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_cliente_id uuid;
    v_acompanhantes jsonb;
BEGIN
    -- 1. Obter informações essenciais do pedido
    SELECT user_id, cliente_id, acompanhantes INTO v_user_id, v_cliente_id, v_acompanhantes
    FROM public.pedidos
    WHERE id = p_pedido_id AND status = 'aberto' AND mesa_id = p_mesa_id AND user_id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Pedido aberto não encontrado para a mesa especificada.';
    END IF;

    -- 2. Fechar o pedido (isso aciona o trigger de pontos)
    UPDATE public.pedidos
    SET status = 'pago', closed_at = NOW(), acompanhantes = v_acompanhantes -- Mantém acompanhantes para histórico
    WHERE id = p_pedido_id;

    -- 3. Liberar a mesa e remover ocupantes
    UPDATE public.mesas
    SET cliente_id = NULL
    WHERE id = p_mesa_id;

    DELETE FROM public.mesa_ocupantes
    WHERE mesa_id = p_mesa_id;

    -- Nota: O envio do webhook de pagamento será tratado no frontend/Edge Function,
    -- pois precisamos do cliente_id principal para o webhook.

END;
$function$