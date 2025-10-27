CREATE OR REPLACE FUNCTION public.check_client_has_open_order(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.status = 'aberto'
    AND p.mesa_id IN (
      -- Mesas onde o cliente é o principal
      SELECT id FROM public.mesas WHERE cliente_id = p_cliente_id
      UNION
      -- Mesas onde o cliente é um ocupante
      SELECT mesa_id FROM public.mesa_ocupantes WHERE cliente_id = p_cliente_id
    )
  );
$$;