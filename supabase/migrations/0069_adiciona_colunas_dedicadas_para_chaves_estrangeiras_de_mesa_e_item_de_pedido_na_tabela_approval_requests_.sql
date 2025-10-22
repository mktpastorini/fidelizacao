-- Adiciona colunas dedicadas para chaves estrangeiras
ALTER TABLE public.approval_requests
ADD COLUMN mesa_id_fk UUID REFERENCES public.mesas(id) ON DELETE CASCADE,
ADD COLUMN item_pedido_id_fk UUID REFERENCES public.itens_pedido(id) ON DELETE CASCADE;

-- Cria um índice para a nova coluna user_id (requester)
CREATE INDEX idx_approval_requests_user_id ON public.approval_requests (user_id);