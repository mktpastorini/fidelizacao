-- 1. Remover a política de INSERT existente para evitar conflitos
DROP POLICY IF EXISTS "Allow anonymous insert for open orders" ON public.itens_pedido;

-- 2. Criar a política de INSERT para usuários anônimos
CREATE POLICY "Allow anonymous insert for open orders" ON public.itens_pedido
FOR INSERT TO anon WITH CHECK (
    -- Verifica se o pedido associado está aberto
    (EXISTS ( 
        SELECT 1
        FROM pedidos
        WHERE (
            (pedidos.id = itens_pedido.pedido_id) 
            AND (pedidos.status = 'aberto'::text)
        )
    ))
    -- E verifica se o user_id do item corresponde ao user_id do pedido (dono do estabelecimento)
    AND (itens_pedido.user_id = (
        SELECT pedidos.user_id
        FROM pedidos
        WHERE pedidos.id = itens_pedido.pedido_id
    ))
);