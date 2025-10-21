-- 1. Remover a política de INSERT existente (se houver uma restritiva)
DROP POLICY IF EXISTS "Users can insert their own data" ON public.pedidos;

-- 2. Criar uma nova política de INSERT que permite a criação por Superadmins, Admins e Gerentes
CREATE POLICY "Admins and Managers can insert orders" ON public.pedidos
FOR INSERT TO authenticated WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);