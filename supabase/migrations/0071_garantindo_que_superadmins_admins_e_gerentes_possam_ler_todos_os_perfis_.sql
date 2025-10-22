-- Permite que Superadmins, Admins e Gerentes leiam todos os perfis
CREATE POLICY "Admins and Managers can select all profiles" ON public.profiles 
FOR SELECT TO authenticated USING ((auth.uid() IN ( SELECT p.id FROM public.profiles p WHERE p.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]))));