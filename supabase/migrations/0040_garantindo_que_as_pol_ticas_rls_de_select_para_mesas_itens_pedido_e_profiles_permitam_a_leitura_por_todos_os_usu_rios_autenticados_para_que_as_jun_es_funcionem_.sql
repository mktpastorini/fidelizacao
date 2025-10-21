-- 1. Garantir que todos os usuários autenticados possam ler todos os perfis (necessário para ver o nome do requisitante)
DROP POLICY IF EXISTS "Allow authenticated users to view all profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- 2. Garantir que todos os usuários autenticados possam ler todas as mesas (necessário para ver o número da mesa)
DROP POLICY IF EXISTS "Allow authenticated users to view all mesas" ON public.mesas;
CREATE POLICY "Allow authenticated users to view all mesas" ON public.mesas FOR SELECT TO authenticated USING (true);

-- 3. Garantir que todos os usuários autenticados possam ler todos os itens de pedido (necessário para ver o item do desconto)
DROP POLICY IF EXISTS "Allow authenticated users to view all order items" ON public.itens_pedido;
CREATE POLICY "Allow authenticated users to view all order items" ON public.itens_pedido FOR SELECT TO authenticated USING (true);

-- 4. Garantir que a política de SELECT para administradores/gerentes na tabela approval_requests seja a mais ampla possível para que a query não falhe.
DROP POLICY IF EXISTS "Superadmins and managers can view all requests" ON public.approval_requests;
CREATE POLICY "Superadmins and managers can view all requests" ON public.approval_requests 
FOR SELECT TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);