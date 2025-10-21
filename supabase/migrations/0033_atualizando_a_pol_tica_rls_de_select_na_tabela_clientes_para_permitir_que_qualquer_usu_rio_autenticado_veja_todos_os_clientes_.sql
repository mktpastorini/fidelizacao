-- 1. Remover a política antiga de SELECT
DROP POLICY IF EXISTS "Usuários podem ver seus próprios clientes" ON public.clientes;

-- 2. Criar uma nova política que permite a leitura por qualquer usuário autenticado
-- (Isso pressupõe que todos os clientes pertencem ao mesmo 'tenant' ou estabelecimento)
CREATE POLICY "Allow authenticated users to view all clients" ON public.clientes 
FOR SELECT TO authenticated USING (true);