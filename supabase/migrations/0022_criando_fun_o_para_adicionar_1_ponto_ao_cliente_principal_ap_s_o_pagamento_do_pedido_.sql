CREATE OR REPLACE FUNCTION public.handle_pedido_pago_points()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    -- Verifica se o status mudou para 'pago' e se há um cliente principal
    IF NEW.status = 'pago' AND OLD.status <> 'pago' AND NEW.cliente_id IS NOT NULL THEN
        -- Adiciona 1 ponto ao cliente
        UPDATE public.clientes
        SET pontos = pontos + 1
        WHERE id = NEW.cliente_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Criando o trigger para chamar a função após a atualização de um pedido
DROP TRIGGER IF EXISTS on_pedido_pago_add_points ON public.pedidos;
CREATE TRIGGER on_pedido_pago_add_points
AFTER UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.handle_pedido_pago_points();