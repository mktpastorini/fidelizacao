-- Permitir INSERT de ocupantes por Garçom/Balcão
CREATE POLICY "Garcom and Balcao can insert mesa occupants" ON public.mesa_ocupantes
FOR INSERT TO authenticated
WITH CHECK (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])
);

-- Permitir DELETE de ocupantes por Garçom/Balcão
CREATE POLICY "Garcom and Balcao can delete mesa occupants" ON public.mesa_ocupantes
FOR DELETE TO authenticated
USING (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])
);