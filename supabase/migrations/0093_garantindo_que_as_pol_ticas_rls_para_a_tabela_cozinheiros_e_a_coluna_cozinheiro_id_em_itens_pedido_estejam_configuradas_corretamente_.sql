-- 1. RLS Policies: Apenas Gerentes/Admins podem gerenciar (CRUD)
DROP POLICY IF EXISTS "Managers and Admins can manage cooks" ON public.cozinheiros;
CREATE POLICY "Managers and Admins can manage cooks" ON public.cozinheiros 
FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'gerente')
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'gerente')
);

-- 2. RLS Policies: Todos os usuários autenticados podem ver a lista de cozinheiros
DROP POLICY IF EXISTS "Allow authenticated users to view all cooks" ON public.cozinheiros;
CREATE POLICY "Allow authenticated users to view all cooks" ON public.cozinheiros 
FOR SELECT TO authenticated 
USING (true);

-- 3. RLS Policy: Cozinheiros podem atualizar seus próprios itens (para marcar como pronto)
-- Esta política garante que o cozinheiro logado (que tem um perfil) só possa atualizar o item se o user_id do cozinheiro na tabela cozinheiros for o mesmo do user_id do item.
-- NOTA: A lógica de validação facial está no Edge Function, mas esta política é um fallback de segurança.
DROP POLICY IF EXISTS "Cozinheiros can update their own items" ON public.itens_pedido;
CREATE POLICY "Cozinheiros can update their own items" ON public.itens_pedido
FOR UPDATE TO authenticated
USING (auth.uid() = (SELECT user_id FROM public.cozinheiros WHERE id = itens_pedido.cozinheiro_id));