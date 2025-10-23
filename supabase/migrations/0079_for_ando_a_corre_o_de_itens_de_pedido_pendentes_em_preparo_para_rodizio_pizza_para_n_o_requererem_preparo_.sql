UPDATE public.itens_pedido
SET requer_preparo = false
WHERE nome_produto ILIKE '%Rodizio Pizza%'
  AND status IN ('pendente', 'preparando');