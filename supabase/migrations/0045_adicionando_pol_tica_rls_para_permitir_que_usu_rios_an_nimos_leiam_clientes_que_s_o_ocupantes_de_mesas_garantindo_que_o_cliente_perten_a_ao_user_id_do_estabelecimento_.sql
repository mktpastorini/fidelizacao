-- 1. Remover a política existente que permite a leitura por todos os autenticados (se houver necessidade de restringir campos no futuro, mas por enquanto, vamos focar no anon)
-- DROP POLICY IF EXISTS "Allow authenticated users to view all clients" ON public.clientes;

-- 2. Criar a política de SELECT para usuários anônimos (anon)
CREATE POLICY "Public read access for clients on occupied tables" ON public.clientes
FOR SELECT TO anon USING (
    -- O cliente deve estar ocupando alguma mesa
    EXISTS (
        SELECT 1
        FROM mesa_ocupantes mo
        WHERE mo.cliente_id = clientes.id
    )
    -- E o cliente deve pertencer ao user_id do estabelecimento
    AND (clientes.user_id IN (
        SELECT m.user_id
        FROM mesas m
        JOIN mesa_ocupantes mo ON m.id = mo.mesa_id
        WHERE mo.cliente_id = clientes.id
    ))
);