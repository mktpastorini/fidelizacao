CREATE OR REPLACE FUNCTION public.handle_pedido_pago_points()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    cliente_id_atual UUID;
    acompanhante_record RECORD;
BEGIN
    -- 1. Verifica se o status mudou para 'pago'
    IF NEW.status = 'pago' AND OLD.status <> 'pago' THEN
        
        -- 2. Adiciona 1 ponto ao cliente principal (se existir)
        IF NEW.cliente_id IS NOT NULL THEN
            UPDATE public.clientes
            SET pontos = pontos + 1
            WHERE id = NEW.cliente_id;
        END IF;

        -- 3. Itera sobre a lista de acompanhantes (se existir) e adiciona 1 ponto a cada um
        IF NEW.acompanhantes IS NOT NULL THEN
            FOR acompanhante_record IN
                SELECT (jsonb_array_elements(NEW.acompanhantes)->>'id')::uuid AS id
            LOOP
                -- Garante que o acompanhante não seja o cliente principal (evita duplicidade se o principal estiver na lista)
                IF acompanhante_record.id IS NOT NULL AND acompanhante_record.id <> NEW.cliente_id THEN
                    UPDATE public.clientes
                    SET pontos = pontos + 1
                    WHERE id = acompanhante_record.id;
                END IF;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;