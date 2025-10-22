-- Remove a política genérica existente se houver conflito
DROP POLICY IF EXISTS "Allow authenticated users to create requests" ON public.approval_requests;

-- Cria uma política explícita para INSERT
CREATE POLICY "Allow authenticated users to insert requests" ON public.approval_requests 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);