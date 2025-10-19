CREATE POLICY "Public read access for order items via open order" ON public.itens_pedido 
FOR SELECT 
USING (EXISTS (
    SELECT 1 
    FROM public.pedidos 
    WHERE pedidos.id = itens_pedido.pedido_id AND pedidos.status = 'aberto'
));