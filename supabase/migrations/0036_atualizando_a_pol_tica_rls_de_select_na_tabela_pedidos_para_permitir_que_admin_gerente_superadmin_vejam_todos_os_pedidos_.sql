-- 1. Remover a política antiga de SELECT na tabela pedidos
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.pedidos;

-- 2. Criar uma nova política que permite a leitura por qualquer usuário autenticado
CREATE POLICY "Allow authenticated users to view all orders" ON public.pedidos 
FOR SELECT TO authenticated USING (true);