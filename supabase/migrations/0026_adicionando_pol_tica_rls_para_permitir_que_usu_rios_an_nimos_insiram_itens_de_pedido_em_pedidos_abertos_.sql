CREATE POLICY "Allow anonymous insert for open orders" ON public.itens_pedido
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.id = itens_pedido.pedido_id
      AND p.status = 'aberto'
  )
);