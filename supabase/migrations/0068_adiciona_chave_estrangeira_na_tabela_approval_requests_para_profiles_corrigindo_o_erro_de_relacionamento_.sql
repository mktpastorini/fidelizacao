-- Adiciona a chave estrangeira para a tabela profiles
ALTER TABLE public.approval_requests
ADD CONSTRAINT fk_requester_profile
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;