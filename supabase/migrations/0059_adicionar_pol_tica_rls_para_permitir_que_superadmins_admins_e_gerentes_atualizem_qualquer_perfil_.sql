CREATE POLICY "Admins and Managers can update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);