CREATE POLICY "Garcom and Balcao can select mesa occupants" ON public.mesa_ocupantes
FOR SELECT TO authenticated
USING (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role, 'gerente'::user_role, 'admin'::user_role, 'superadmin'::user_role])
);