SELECT id, nome_produto, status, requer_preparo, created_at FROM public.itens_pedido 
WHERE nome_produto ILIKE '%Rodizio Pizza%' 
  AND status IN ('pendente', 'preparando') 
  AND requer_preparo = true;