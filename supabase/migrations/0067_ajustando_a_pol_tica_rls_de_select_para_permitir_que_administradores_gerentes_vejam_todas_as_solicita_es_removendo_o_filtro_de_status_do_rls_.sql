-- Remove a política anterior
DROP POLICY IF EXISTS "Allow managers/admins to view pending requests" ON public.approval_requests;

-- Cria uma política que permite a visualização de todas as solicitações para Superadmin, Admin e Gerente.
-- O filtro de status ('pending') será feito na query do frontend.
CREATE POLICY "Allow managers/admins to view all requests" ON public.approval_requests 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
    )
);