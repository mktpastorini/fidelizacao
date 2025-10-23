-- 1. Permitir que qualquer usuário autenticado veja TODAS as categorias (Catálogo Global)
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categorias;
CREATE POLICY "Allow authenticated users to view all categories" ON public.categorias 
FOR SELECT TO authenticated USING (true);

-- 2. Permitir que Superadmin, Admin e Gerente gerenciem (INSERT, UPDATE, DELETE)
CREATE POLICY "Allow managers and admins to manage categories" ON public.categorias 
FOR ALL TO authenticated 
USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    IN ('superadmin', 'admin', 'gerente')
)
WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    IN ('superadmin', 'admin', 'gerente')
);