-- Adicionando colunas para gorjeta e garçom responsável na tabela pedidos
ALTER TABLE public.pedidos
ADD COLUMN gorjeta_valor NUMERIC DEFAULT 0,
ADD COLUMN garcom_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Criando índice para garcom_id para otimizar consultas de gorjetas
CREATE INDEX idx_pedidos_garcom_id ON public.pedidos (garcom_id);