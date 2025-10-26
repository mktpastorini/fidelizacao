-- Add columns to user_settings for multi-detection config
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS multi_detection_interval INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS multi_detection_confidence NUMERIC DEFAULT 0.85;

-- Create RPC function to get customer's table details for Cashier Mode
CREATE OR REPLACE FUNCTION public.get_customer_table_details(p_cliente_id uuid)
RETURNS TABLE(
  mesa_id uuid,
  mesa_numero integer,
  pedido jsonb,
  ocupantes jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_mesa_id UUID;
BEGIN
    -- Find the mesa_id for the given cliente_id from either the main client or occupants
    SELECT m.id INTO v_mesa_id
    FROM public.mesas m
    LEFT JOIN public.mesa_ocupantes mo ON m.id = mo.mesa_id
    WHERE m.cliente_id = p_cliente_id OR mo.cliente_id = p_cliente_id
    LIMIT 1;

    IF v_mesa_id IS NOT NULL THEN
        RETURN QUERY
        SELECT
            m.id as mesa_id,
            m.numero as mesa_numero,
            jsonb_build_object(
              'id', p.id,
              'created_at', p.created_at,
              'itens_pedido', COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', ip.id,
                    'nome_produto', ip.nome_produto,
                    'quantidade', ip.quantidade,
                    'preco', ip.preco,
                    'desconto_percentual', ip.desconto_percentual,
                    'consumido_por_cliente_id', ip.consumido_por_cliente_id
                  )
                )
                FROM public.itens_pedido ip
                WHERE ip.pedido_id = p.id
              ), '[]'::jsonb)
            ) as pedido,
            COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', c.id,
                  'nome', c.nome
                )
              )
              FROM public.mesa_ocupantes mo
              JOIN public.clientes c ON mo.cliente_id = c.id
              WHERE mo.mesa_id = m.id
            ), '[]'::jsonb) as ocupantes
        FROM public.mesas m
        JOIN public.pedidos p ON p.mesa_id = m.id
        WHERE m.id = v_mesa_id AND p.status = 'aberto'
        LIMIT 1;
    END IF;
END;
$$;