CREATE POLICY "Garcom and Balcao can mark non-prep items as delivered" ON public.itens_pedido
FOR UPDATE TO authenticated
USING (
    (
        (
            SELECT profiles.role
            FROM profiles
            WHERE (profiles.id = auth.uid())
        ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])
    )
    AND (itens_pedido.requer_preparo = false)
);