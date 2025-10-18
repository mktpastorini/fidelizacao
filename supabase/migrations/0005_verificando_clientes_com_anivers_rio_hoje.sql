SELECT 
    c.nome,
    c.whatsapp,
    c.data_nascimento
FROM 
    public.clientes c
WHERE 
    c.data_nascimento IS NOT NULL
    AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM NOW())
    AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM NOW());