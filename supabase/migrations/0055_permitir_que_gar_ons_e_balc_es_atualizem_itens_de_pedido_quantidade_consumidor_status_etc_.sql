-- DROP e CREATE para garantir que a política seja a mais recente e abrangente
DROP POLICY IF EXISTS "Garcom and Balcao can update order items" ON public.itens_pedido;
CREATE POLICY "Garcom and Balcao can update order items" ON public.itens_pedido
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