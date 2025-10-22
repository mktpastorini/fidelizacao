-- Drop existing INSERT policy for admins/managers
DROP POLICY IF EXISTS "Admins and Managers can insert orders" ON public.pedidos;

-- Create a new INSERT policy that includes garcom and balcao
CREATE POLICY "Staff can insert orders" ON public.pedidos 
FOR INSERT TO authenticated WITH CHECK (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role, 'balcao'::user_role, 'garcom'::user_role])
);