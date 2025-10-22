-- Remove a política anterior
DROP POLICY IF EXISTS "Allow authenticated users to insert requests" ON public.approval_requests;

-- Cria a política que permite a inserção para qualquer usuário autenticado, verificando se o user_id corresponde ao usuário logado.
CREATE POLICY "Allow authenticated users to insert requests" ON public.approval_requests 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);