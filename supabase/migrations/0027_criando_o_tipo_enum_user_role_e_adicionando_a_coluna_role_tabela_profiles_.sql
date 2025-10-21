-- 1. Cria o tipo ENUM para as funções (se já existir, ignora)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('superadmin', 'admin', 'gerente', 'balcao', 'garcom', 'cozinha');
    END IF;
END $$;

-- 2. Adiciona a coluna 'role' à tabela profiles (se não existir)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles
        ADD COLUMN role public.user_role DEFAULT 'garcom';
    END IF;
END $$;