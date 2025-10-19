DROP TRIGGER IF EXISTS on_item_pedido_insert_decrement_stock ON public.itens_pedido;
CREATE TRIGGER on_item_pedido_insert_decrement_stock
AFTER INSERT ON public.itens_pedido
FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock();