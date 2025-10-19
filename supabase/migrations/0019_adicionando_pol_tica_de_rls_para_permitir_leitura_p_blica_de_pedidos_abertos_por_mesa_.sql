CREATE POLICY "Public read access for open orders by mesa_id" ON public.pedidos 
FOR SELECT 
USING (status = 'aberto');