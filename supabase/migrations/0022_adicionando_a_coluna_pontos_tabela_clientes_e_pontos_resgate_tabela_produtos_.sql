-- 1. Adicionar coluna 'pontos' à tabela clientes
ALTER TABLE public.clientes
ADD COLUMN pontos INTEGER NOT NULL DEFAULT 0;

-- 2. Adicionar coluna 'pontos_resgate' à tabela produtos
ALTER TABLE public.produtos
ADD COLUMN pontos_resgate INTEGER NULL;

-- 3. Atualizar a política de RLS para permitir que usuários vejam seus próprios pontos
DROP POLICY IF EXISTS "Usuários podem ver seus próprios clientes" ON public.clientes;
CREATE POLICY "Usuários podem ver seus próprios clientes" ON public.clientes 
FOR SELECT TO authenticated USING (auth.uid() = user_id);