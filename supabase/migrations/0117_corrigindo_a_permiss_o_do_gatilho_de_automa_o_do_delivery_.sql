CREATE OR REPLACE FUNCTION public.handle_delivery_item_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_pedido_id UUID;
    v_order_type TEXT;
    v_is_ready BOOLEAN;
BEGIN
    -- Só executa se o status do item foi alterado para 'entregue'
    IF NEW.status = 'entregue' AND OLD.status <> 'entregue' THEN
        
        -- Obtém o ID e o tipo do pedido associado
        SELECT id, order_type INTO v_pedido_id, v_order_type
        FROM public.pedidos
        WHERE id = NEW.pedido_id;

        -- Só continua se for um pedido de IFOOD ou DELIVERY
        IF v_order_type IN ('IFOOD', 'DELIVERY') THEN
            
            -- Verifica se todos os itens do pedido estão prontos
            SELECT public.check_delivery_order_readiness(v_pedido_id) INTO v_is_ready;

            -- Se todos os itens estiverem prontos, atualiza o status do pedido principal
            IF v_is_ready THEN
                UPDATE public.pedidos
                SET delivery_status = 'ready_for_delivery'
                WHERE id = v_pedido_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;