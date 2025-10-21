-- 1. Atualizar a política de RLS para permitir que usuários vejam seus próprios clientes (incluindo a coluna 'pontos')
DROP POLICY IF EXISTS "Usuários podem ver seus próprios clientes" ON public.clientes;
CREATE POLICY "Usuários podem ver seus próprios clientes" ON public.clientes 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Criando função para adicionar 1 ponto ao cliente principal após o pagamento do pedido.
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

-- 3. Criando o trigger para chamar a função após a atualização de um pedido
DROP TRIGGER IF EXISTS on_pedido_pago_add_points ON public.pedidos;
CREATE TRIGGER on_pedido_pago_add_points
AFTER UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.handle_pedido_pago_points();