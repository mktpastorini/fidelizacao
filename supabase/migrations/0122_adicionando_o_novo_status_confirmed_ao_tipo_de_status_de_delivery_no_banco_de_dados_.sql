-- Adiciona o novo valor 'CONFIRMED' ao tipo ENUM, se ele ainda não existir.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONFIRMED' AND enumtypid = 'public.delivery_status_enum'::regtype) THEN
        ALTER TYPE public.delivery_status_enum ADD VALUE 'CONFIRMED' AFTER 'awaiting_confirmation';
    END IF;
END$$;