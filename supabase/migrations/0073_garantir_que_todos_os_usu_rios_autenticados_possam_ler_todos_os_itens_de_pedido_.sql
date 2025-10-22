-- Remove a política existente que permite a leitura de todos os itens de pedido (se existir)
DROP POLICY IF EXISTS "Allow authenticated users to view all order items" ON public.itens_pedido;

-- Cria uma nova política para garantir que qualquer usuário autenticado possa ler qualquer item de pedido
CREATE POLICY "Allow authenticated users to view all order items" ON public.itens_pedido 
FOR SELECT TO authenticated USING (true);