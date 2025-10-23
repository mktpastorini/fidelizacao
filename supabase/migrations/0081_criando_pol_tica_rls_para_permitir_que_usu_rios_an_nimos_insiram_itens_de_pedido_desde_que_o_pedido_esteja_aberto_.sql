CREATE POLICY "Allow anonymous insert for open orders" ON public.itens_pedido
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pedidos
    WHERE pedidos.id = itens_pedido.pedido_id
      AND pedidos.status = 'aberto'
  )
);