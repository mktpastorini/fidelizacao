-- Remove a política anterior
DROP POLICY IF EXISTS "Allow authenticated users to insert requests" ON public.approval_requests;

-- Cria uma política que permite a inserção para usuários autenticados, verificando se o user_id corresponde ao uid E se o papel é um dos que precisam de aprovação.
CREATE POLICY "Allow staff to request approval" ON public.approval_requests 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.uid() = user_id) 
    AND (requester_role = ANY (ARRAY['balcao'::user_role, 'garcom'::user_role, 'cozinha'::user_role]))
);