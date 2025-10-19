CREATE OR REPLACE FUNCTION public.get_low_stock_products()
 RETURNS TABLE(id uuid, nome text, estoque_atual integer, alerta_estoque_baixo integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    p.id,
    p.nome,
    p.estoque_atual,
    p.alerta_estoque_baixo
  FROM
    public.produtos p
  WHERE
    p.user_id = auth.uid()
    AND p.estoque_atual <= p.alerta_estoque_baixo
    AND p.estoque_atual > 0; -- Exclui itens esgotados (estoque 0)
$function$;