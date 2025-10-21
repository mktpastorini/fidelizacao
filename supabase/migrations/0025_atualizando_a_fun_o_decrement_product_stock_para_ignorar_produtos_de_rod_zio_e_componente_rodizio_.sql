CREATE OR REPLACE FUNCTION public.decrement_product_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_produto_id UUID;
    v_produto_tipo TEXT;
BEGIN
    -- 1. Encontrar o ID e o TIPO do produto com base no nome e user_id
    SELECT id, tipo INTO v_produto_id, v_produto_tipo
    FROM public.produtos
    WHERE nome = NEW.nome_produto AND user_id = NEW.user_id;

    -- 2. Se o produto for encontrado E o tipo for 'venda' (à la carte)
    IF v_produto_id IS NOT NULL AND v_produto_tipo = 'venda' THEN
        -- 3. Decrementar o estoque atual pela quantidade do item
        UPDATE public.produtos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = v_produto_id;
    END IF;

    RETURN NEW;
END;
$function$;