CREATE OR REPLACE FUNCTION public.get_tip_stats(
    p_user_id uuid,
    start_date timestamp with time zone,
    end_date timestamp with time zone
)
RETURNS TABLE(
    garcom_id uuid,
    garcom_nome text,
    total_gorjetas numeric,
    total_pedidos bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT
        p.garcom_id,
        (SELECT pr.first_name || ' ' || pr.last_name FROM public.profiles pr WHERE pr.id = p.garcom_id) AS garcom_nome,
        COALESCE(SUM(p.gorjeta_valor), 0) AS total_gorjetas,
        COUNT(p.id) AS total_pedidos
    FROM
        public.pedidos p
    WHERE
        p.user_id = p_user_id
        AND p.status = 'pago'
        AND p.garcom_id IS NOT NULL
        AND p.closed_at BETWEEN start_date AND end_date
    GROUP BY
        p.garcom_id
    ORDER BY
        total_gorjetas DESC;
$function$;