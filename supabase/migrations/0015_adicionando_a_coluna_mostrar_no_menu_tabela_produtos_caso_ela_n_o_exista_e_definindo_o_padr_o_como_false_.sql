DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'produtos' AND column_name = 'mostrar_no_menu'
    ) THEN
        ALTER TABLE public.produtos ADD COLUMN mostrar_no_menu BOOLEAN DEFAULT FALSE;
    END IF;
END
$$;