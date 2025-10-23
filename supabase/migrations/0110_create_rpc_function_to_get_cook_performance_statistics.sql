CREATE OR REPLACE FUNCTION public.get_cook_performance_stats(
    p_user_id uuid,
    start_date timestamp with time zone,
    end_date timestamp with time zone
)
RETURNS TABLE(
    cozinheiro_id uuid,
    cozinheiro_nome text,
    total_pratos_finalizados bigint,
    tempo_medio_preparo_min numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT
        ip.cozinheiro_id,
        (SELECT c.nome FROM public.cozinheiros c WHERE c.id = ip.cozinheiro_id) AS cozinheiro_nome,
        COUNT(ip.id) AS total_pratos_finalizados,
        COALESCE(
            AVG(EXTRACT(EPOCH FROM (ip.hora_entrega - ip.hora_inicio_preparo)) / 60),
            0
        )::numeric AS tempo_medio_preparo_min
    FROM
        public.itens_pedido ip
    WHERE
        ip.user_id = p_user_id
        AND ip.status = 'entregue'
        AND ip.requer_preparo = TRUE -- Apenas itens que realmente foram preparados
        AND ip.hora_entrega BETWEEN start_date AND end_date
        AND ip.cozinheiro_id IS NOT NULL
    GROUP BY
        ip.cozinheiro_id
    ORDER BY
        total_pratos_finalizados DESC;
$function$;