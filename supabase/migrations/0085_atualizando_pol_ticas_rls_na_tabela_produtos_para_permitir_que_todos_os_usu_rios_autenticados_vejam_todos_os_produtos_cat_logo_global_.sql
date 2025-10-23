-- 1. Remover a política antiga que restringe a visualização por user_id
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios produtos" ON public.produtos;

-- 2. Permitir que qualquer usuário autenticado veja TODOS os produtos (Catálogo Global)
CREATE POLICY "Allow authenticated users to view all products" ON public.produtos 
FOR SELECT TO authenticated USING (true);

-- 3. Permitir que Superadmin, Admin e Gerente gerenciem (INSERT, UPDATE, DELETE)
-- Esta política já existe e será recriada para garantir que o RLS esteja correto.
DROP POLICY IF EXISTS "Allow managers and admins to manage products" ON public.produtos;
CREATE POLICY "Allow managers and admins to manage products" ON public.produtos 
FOR ALL TO authenticated 
USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    IN ('superadmin', 'admin', 'gerente')
)
WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    IN ('superadmin', 'admin', 'gerente')
);