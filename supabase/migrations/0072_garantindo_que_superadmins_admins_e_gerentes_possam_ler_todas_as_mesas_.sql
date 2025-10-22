-- Permite que Superadmins, Admins e Gerentes leiam todas as mesas
CREATE POLICY "Admins and Managers can select all mesas" ON public.mesas 
FOR SELECT TO authenticated USING ((auth.uid() IN ( SELECT p.id FROM public.profiles p WHERE p.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]))));