-- 1. Criar uma função para verificar se a mesa pode ser liberada (se não houver itens em preparo)
CREATE OR REPLACE FUNCTION public.check_mesa_can_be_freed(p_mesa_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.pedidos p
    JOIN public.itens_pedido ip ON p.id = ip.pedido_id
    WHERE p.mesa_id = p_mesa_id
      AND p.status = 'aberto'
      AND ip.status = 'preparando'
  );
$$;

-- 2. Atualizar a função de processamento de aprovação para incluir a lógica de cancelamento de itens pendentes e verificação de mesa travada
CREATE OR REPLACE FUNCTION public.process_free_table_request(p_request_id uuid, p_approved_by uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_mesa_id UUID;
    v_open_order_id UUID;
    v_cancelled_items JSONB;
    v_occupants JSONB;
    v_mesa_numero INTEGER;
    v_can_be_freed BOOLEAN;
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
        -- Se houver itens em preparo, a mesa está travada.
        RAISE EXCEPTION 'Mesa % não pode ser liberada: existem itens em preparo.', v_mesa_numero;
    END IF;

    -- 3. Tenta encontrar o pedido aberto
    SELECT id, acompanhantes INTO v_open_order_id, v_occupants
    FROM public.pedidos
    WHERE mesa_id = v_mesa_id AND status = 'aberto'
    ORDER BY created_at DESC
    LIMIT 1;

    v_cancelled_items := '[]'::jsonb;

    IF v_open_order_id IS NOT NULL THEN
        -- 4. Coletar e cancelar itens PENDENTES do cliente principal (cliente_id)
        WITH pending_items AS (
            SELECT id, nome_produto, quantidade, preco, desconto_percentual, desconto_motivo
            FROM public.itens_pedido
            WHERE pedido_id = v_open_order_id
              AND status = 'pendente'
              AND consumido_por_cliente_id = (SELECT cliente_id FROM public.pedidos WHERE id = v_open_order_id)
        )
        -- Coletar itens cancelados para o payload
        SELECT jsonb_agg(row_to_json(pi)) INTO v_cancelled_items FROM pending_items pi;

        -- Deletar os itens pendentes do cliente principal
        DELETE FROM public.itens_pedido
        WHERE pedido_id = v_open_order_id
          AND status = 'pendente'
          AND consumido_por_cliente_id = (SELECT cliente_id FROM public.pedidos WHERE id = v_open_order_id);

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

    -- 7. Atualizar a solicitação como aprovada
    UPDATE public.approval_requests
    SET 
        status = 'approved', 
        approved_by = p_approved_by, 
        approved_at = NOW(),
        payload = jsonb_set(payload, '{cancelled_items}', COALESCE(v_cancelled_items, '[]'::jsonb))
    WHERE id = p_request_id;

    RETURN json_build_object('success', TRUE, 'message', 'Mesa liberada e itens pendentes do cliente principal cancelados.');

END;
$$;

-- 3. Atualizar a política RLS para permitir que cozinheiros gerenciem seus próprios itens
-- (Usando a coluna cozinheiro_id que já existe)
DROP POLICY IF EXISTS "Cozinheiros can update their own items" ON public.itens_pedido;
CREATE POLICY "Cozinheiros can update their own items" ON public.itens_pedido 
FOR UPDATE TO authenticated USING (auth.uid() = ( SELECT cozinheiros.user_id FROM cozinheiros WHERE cozinheiros.id = itens_pedido.cozinheiro_id));