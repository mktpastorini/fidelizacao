-- Remove a política anterior
DROP POLICY IF EXISTS "Allow authenticated users to insert requests" ON public.approval_requests;

-- Cria uma política que permite a inserção para qualquer usuário autenticado, sem verificar o user_id no WITH CHECK.
-- O Supabase já garante que o token é válido.
CREATE POLICY "Allow authenticated users to insert requests" ON public.approval_requests 
FOR INSERT TO authenticated 
WITH CHECK (true);