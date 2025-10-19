CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_produto_id UUID;
BEGIN
    -- 1. Encontrar o ID do produto com base no nome e user_id
    SELECT id INTO v_produto_id
    FROM public.produtos
    WHERE nome = NEW.nome_produto AND user_id = NEW.user_id;

    -- 2. Se o produto for encontrado e não for um item de rodízio (que não afeta o estoque principal)
    IF v_produto_id IS NOT NULL THEN
        -- 3. Decrementar o estoque atual pela quantidade do item
        UPDATE public.produtos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = v_produto_id;
    END IF;

    RETURN NEW;
END;
$$;