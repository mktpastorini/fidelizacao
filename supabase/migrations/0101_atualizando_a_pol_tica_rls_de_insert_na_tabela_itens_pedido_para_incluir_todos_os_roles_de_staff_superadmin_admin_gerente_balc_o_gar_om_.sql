-- Remove a política existente para evitar conflitos
DROP POLICY IF EXISTS "Garcom and Balcao can insert order items" ON public.itens_pedido;

-- Cria uma nova política que permite a inserção para todos os roles de staff
CREATE POLICY "Staff can insert order items" ON public.itens_pedido
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role, 'balcao'::user_role, 'garcom'::user_role])
);