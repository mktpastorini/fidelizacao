-- 1. Permitir UPDATE em mesas
DROP POLICY IF EXISTS "Users can manage their own mesas" ON public.mesas;
CREATE POLICY "Admins and Managers can manage mesas" ON public.mesas
FOR ALL TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
) WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);

-- 2. Permitir UPDATE/DELETE em pedidos (para cancelamento/limpeza)
DROP POLICY IF EXISTS "Users can manage their own orders" ON public.pedidos;
CREATE POLICY "Admins and Managers can manage orders" ON public.pedidos
FOR ALL TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
) WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);

-- 3. Permitir DELETE em mesa_ocupantes
DROP POLICY IF EXISTS "Usuários podem gerenciar os ocupantes de suas mesas" ON public.mesa_ocupantes;
CREATE POLICY "Admins and Managers can manage mesa occupants" ON public.mesa_ocupantes
FOR ALL TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
) WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);