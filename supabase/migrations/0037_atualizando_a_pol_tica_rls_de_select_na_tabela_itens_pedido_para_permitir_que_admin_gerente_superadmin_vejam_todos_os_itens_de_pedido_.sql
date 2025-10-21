-- 1. Remover a política antiga de SELECT na tabela itens_pedido
DROP POLICY IF EXISTS "Users can manage their own order items" ON public.itens_pedido;

-- 2. Criar uma nova política que permite a leitura por qualquer usuário autenticado
CREATE POLICY "Allow authenticated users to view all order items" ON public.itens_pedido 
FOR SELECT TO authenticated USING (true);