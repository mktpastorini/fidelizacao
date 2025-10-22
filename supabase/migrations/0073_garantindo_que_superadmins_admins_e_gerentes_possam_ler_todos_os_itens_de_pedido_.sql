-- Permite que Superadmins, Admins e Gerentes leiam todos os itens de pedido
CREATE POLICY "Admins and Managers can select all itens_pedido" ON public.itens_pedido 
FOR SELECT TO authenticated USING ((auth.uid() IN ( SELECT p.id FROM public.profiles p WHERE p.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]))));