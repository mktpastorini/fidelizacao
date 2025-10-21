-- Permitir INSERT de itens de pedido por Garçom/Balcão
CREATE POLICY "Garcom and Balcao can insert order items" ON public.itens_pedido
FOR INSERT TO authenticated
WITH CHECK (
    (
        SELECT profiles.role
        FROM profiles
        WHERE (profiles.id = auth.uid())
    ) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])
);