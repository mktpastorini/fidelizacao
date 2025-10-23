CREATE OR REPLACE FUNCTION public.handle_new_occupant_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_settings record;
    v_produto record;
    v_pedido_id uuid;
    v_nome_final text;
    v_requer_preparo boolean;
BEGIN
    -- Encontra o user_id associado à mesa
    SELECT user_id INTO v_user_id FROM public.mesas WHERE id = NEW.mesa_id;

    -- Busca as configurações do usuário
    SELECT auto_add_item_enabled, default_produto_id
    INTO v_settings
    FROM public.user_settings
    WHERE id = v_user_id;

    -- Se a funcionalidade estiver habilitada e um produto padrão definido
    IF v_settings.auto_add_item_enabled AND v_settings.default_produto_id IS NOT NULL THEN
        -- Busca os detalhes do produto padrão
        SELECT nome, preco, tipo, requer_preparo INTO v_produto FROM public.produtos WHERE id = v_settings.default_produto_id;

        -- Determina o nome final e se requer preparo
        v_nome_final := v_produto.nome;
        v_requer_preparo := v_produto.requer_preparo;

        IF v_produto.tipo = 'rodizio' OR v_produto.tipo = 'componente_rodizio' THEN
            v_nome_final := '[RODIZIO] ' || v_produto.nome;
            v_requer_preparo := FALSE; -- Garante que itens de rodízio não requerem preparo
        END IF;

        -- Encontra o pedido aberto para a mesa
        SELECT id INTO v_pedido_id FROM public.pedidos WHERE mesa_id = NEW.mesa_id AND status = 'aberto';

        -- Se houver um pedido aberto e um produto válido, insere o item
        IF v_pedido_id IS NOT NULL AND v_produto IS NOT NULL THEN
            INSERT INTO public.itens_pedido (pedido_id, user_id, nome_produto, preco, quantidade, consumido_por_cliente_id, requer_preparo)
            VALUES (v_pedido_id, v_user_id, v_nome_final, v_produto.preco, 1, NEW.cliente_id, v_requer_preparo);
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;