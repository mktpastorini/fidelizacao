CREATE OR REPLACE FUNCTION public.get_cook_performance_details(
    p_user_id uuid,
    p_cozinheiro_id uuid,
    start_date timestamp with time zone,
    end_date timestamp with time zone
)
 RETURNS TABLE(
    item_id uuid,
    nome_produto text,
    mesa_numero integer,
    hora_inicio_preparo timestamp with time zone,
    hora_entrega timestamp with time zone,
    tempo_conclusao_min numeric
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT
        ip.id AS item_id,
        ip.nome_produto,
        m.numero AS mesa_numero,
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
    JOIN
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