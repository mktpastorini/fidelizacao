ALTER TABLE public.itens_pedido
ADD COLUMN cozinheiro_id UUID REFERENCES public.cozinheiros(id) ON DELETE SET NULL;

-- Criando política de UPDATE para permitir que cozinheiros atualizem o próprio item
CREATE POLICY "Cozinheiros can update their own items" ON public.itens_pedido
FOR UPDATE TO authenticated
USING (auth.uid() = (SELECT user_id FROM public.cozinheiros WHERE id = cozinheiro_id));