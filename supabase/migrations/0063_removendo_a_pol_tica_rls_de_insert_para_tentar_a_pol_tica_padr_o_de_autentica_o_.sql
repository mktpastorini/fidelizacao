-- Remove a política explícita
DROP POLICY IF EXISTS "Allow authenticated users to insert requests" ON public.approval_requests;

-- A política padrão 'Allow authenticated users to insert requests' (que usa USING (true)) deve ser suficiente.
-- Se o problema for o RLS, a única forma de contornar é garantir que o tipo 'user_role' seja aceito.