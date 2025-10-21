-- 1. Remover a política antiga de SELECT na tabela mesas
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar suas próprias mesas" ON public.mesas;

-- 2. Criar uma nova política que permite a leitura por qualquer usuário autenticado
CREATE POLICY "Allow authenticated users to view all mesas" ON public.mesas 
FOR SELECT TO authenticated USING (true);