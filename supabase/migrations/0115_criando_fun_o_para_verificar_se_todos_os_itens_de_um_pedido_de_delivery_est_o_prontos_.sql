CREATE OR REPLACE FUNCTION public.check_delivery_order_readiness(p_pedido_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
    -- Retorna TRUE se NÃO existir nenhum item no pedido que NÃO esteja 'entregue' ou 'cancelado'.
    -- Em outras palavras, todos os itens estão prontos ou foram cancelados.
    SELECT NOT EXISTS (
        SELECT 1
        FROM public.itens_pedido ip
        WHERE ip.pedido_id = p_pedido_id
          AND ip.status <> 'entregue'
          AND ip.status <> 'cancelado' -- Ignora itens cancelados na verificação
    );
$$;