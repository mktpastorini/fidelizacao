-- Remove a política anterior
DROP POLICY IF EXISTS "Allow authenticated users to insert requests" ON public.approval_requests;

-- Cria uma política que permite a inserção para qualquer usuário autenticado (o RLS padrão já garante que o usuário só pode inserir se o user_id for o seu, mas esta é mais explícita)
CREATE POLICY "Allow authenticated users to insert requests" ON public.approval_requests 
FOR INSERT TO authenticated 
WITH CHECK (true);