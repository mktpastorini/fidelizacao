CREATE POLICY "Garcom and Balcao can delete order items" ON public.itens_pedido
FOR DELETE TO authenticated
USING (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])
);