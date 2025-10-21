-- Adicionar política de SELECT para usuários anônimos na tabela mesa_ocupantes
CREATE POLICY "Public read access for mesa occupants" ON public.mesa_ocupantes
FOR SELECT TO anon USING (
    EXISTS (
        SELECT 1
        FROM mesas m
        WHERE (m.id = mesa_ocupantes.mesa_id AND m.cliente_id IS NOT NULL)
    )
);