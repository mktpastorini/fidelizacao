WITH duplicate_open_orders AS (
    SELECT
        id,
        mesa_id,
        status,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY mesa_id ORDER BY created_at DESC) as rn
    FROM
        public.pedidos
    WHERE
        status = 'aberto'
)
UPDATE public.pedidos
SET status = 'cancelado'
WHERE id IN (
    SELECT id
    FROM duplicate_open_orders
    WHERE rn > 1
);