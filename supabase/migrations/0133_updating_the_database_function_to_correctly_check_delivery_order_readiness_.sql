CREATE OR REPLACE FUNCTION public.check_delivery_order_readiness(p_pedido_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    -- Retorna TRUE se NÃO existir nenhum item no pedido QUE REQUER PREPARO e que esteja 'pendente' ou 'preparando'.
    -- Itens que não requerem preparo são de responsabilidade do balcão/empacotamento e são tratados em outro fluxo.
    SELECT NOT EXISTS (
        SELECT 1
        FROM public.itens_pedido ip
        WHERE ip.pedido_id = p_pedido_id
          AND ip.requer_preparo = TRUE -- Foca apenas nos itens da cozinha
          AND ip.status IN ('pendente', 'preparando')
    );
$function$