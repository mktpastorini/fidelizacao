-- Adicionar colunas para o modo Caixa com valores padrão
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS caixa_interval INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS caixa_confidence NUMERIC DEFAULT 0.85;

-- Adicionar colunas para o modo Saída com valores padrão
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS saida_interval INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS saida_confidence NUMERIC DEFAULT 0.90;