-- Permitir UPDATE na tabela mesas (apenas cliente_id) por Garçom/Balcão
CREATE POLICY "Garcom and Balcao can update mesa client_id" ON public.mesas
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