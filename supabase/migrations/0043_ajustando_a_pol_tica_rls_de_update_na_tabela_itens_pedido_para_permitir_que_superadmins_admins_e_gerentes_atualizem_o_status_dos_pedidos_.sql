-- 1. Remover a política de UPDATE existente (se houver uma restritiva)
DROP POLICY IF EXISTS "Allow anonymous insert for open orders" ON public.itens_pedido;

-- 2. Criar uma política de UPDATE que permite a atualização por Superadmins, Admins e Gerentes
CREATE POLICY "Admins and Managers can update order items" ON public.itens_pedido
FOR UPDATE TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
) WITH CHECK (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);