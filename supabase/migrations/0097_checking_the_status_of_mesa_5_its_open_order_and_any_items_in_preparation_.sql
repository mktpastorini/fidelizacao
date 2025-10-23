SELECT
    m.id AS mesa_id,
    m.numero AS mesa_numero,
    p.id AS pedido_id,
    p.status AS pedido_status,
    ip.id AS item_id,
    ip.nome_produto,
    ip.status AS item_status,
    ip.requer_preparo
FROM
    public.mesas m
LEFT JOIN
    public.pedidos p ON m.id = p.mesa_id AND p.status = 'aberto'
LEFT JOIN
    public.itens_pedido ip ON p.id = ip.pedido_id
WHERE
    m.numero = 5;