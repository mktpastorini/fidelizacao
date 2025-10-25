DROP FUNCTION IF EXISTS public.get_cook_performance_details(uuid, uuid, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_cook_performance_details(p_user_id uuid, p_cozinheiro_id uuid, start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(item_id uuid, nome_produto text, local_pedido text, hora_inicio_preparo timestamp with time zone, hora_entrega timestamp with time zone, tempo_conclusao_min numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT
        ip.id AS item_id,
        ip.nome_produto,
        CASE
            WHEN p.order_type = 'SALAO' THEN 'Mesa ' || m.numero::text
            WHEN p.order_type = 'IFOOD' THEN 'iFood #' || RIGHT(p.ifood_order_id, 4)
            WHEN p.order_type = 'DELIVERY' THEN 'Delivery'
            ELSE 'N/A'
        END AS local_pedido,
        ip.hora_inicio_preparo,
        ip.hora_entrega,
        COALESCE(
            EXTRACT(EPOCH FROM (ip.hora_entrega - ip.hora_inicio_preparo)) / 60,
            0
        )::numeric AS tempo_conclusao_min
    FROM
        public.itens_pedido ip
    JOIN
        public.pedidos p ON ip.pedido_id = p.id
    LEFT JOIN
        public.mesas m ON p.mesa_id = m.id
    WHERE
        ip.user_id = p_user_id
        AND ip.cozinheiro_id = p_cozinheiro_id
        AND ip.status = 'entregue'
        AND ip.requer_preparo = TRUE
        AND ip.hora_entrega BETWEEN start_date AND end_date
    ORDER BY
        ip.hora_entrega DESC;
$function$;