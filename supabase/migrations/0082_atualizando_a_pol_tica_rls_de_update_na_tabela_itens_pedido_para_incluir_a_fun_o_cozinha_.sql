DROP POLICY IF EXISTS "Admins and Managers can update order items" ON public.itens_pedido;

CREATE POLICY "Admins, Managers, and Kitchen can update order items" ON public.itens_pedido
FOR UPDATE TO authenticated
USING (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
  = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role, 'cozinha'::user_role])
);