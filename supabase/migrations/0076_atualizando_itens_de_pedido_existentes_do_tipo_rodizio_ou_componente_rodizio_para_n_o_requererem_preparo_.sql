UPDATE public.itens_pedido ip
SET requer_preparo = false
FROM public.produtos p
WHERE ip.nome_produto = p.nome
  AND ip.user_id = p.user_id
  AND p.tipo IN ('rodizio', 'componente_rodizio')
  AND ip.requer_preparo = true;