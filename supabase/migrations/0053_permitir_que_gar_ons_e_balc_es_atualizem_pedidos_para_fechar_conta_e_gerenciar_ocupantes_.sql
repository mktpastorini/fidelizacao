CREATE POLICY "Garcom and Balcao can update pedidos" ON public.pedidos
FOR UPDATE TO authenticated
USING (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])
)
WITH CHECK (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])
);