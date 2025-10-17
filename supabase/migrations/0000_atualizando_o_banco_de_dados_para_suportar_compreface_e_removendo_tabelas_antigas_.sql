-- Adiciona colunas para as configurações do CompreFace
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS compreface_url TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS compreface_api_key TEXT;

-- Remove a coluna antiga que não será mais usada
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS ai_provider;

-- Remove a tabela antiga de armazenamento de faces, pois o CompreFace fará isso
DROP TABLE IF EXISTS public.customer_faces;