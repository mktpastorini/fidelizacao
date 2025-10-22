-- 1. Remove a política existente (se houver)
DROP POLICY IF EXISTS "Superadmins and managers can view all requests" ON public.approval_requests;

-- 2. Cria a política para permitir que Superadmin, Admin e Gerente vejam todas as solicitações.
-- Usamos EXISTS para garantir que a subconsulta de perfil não cause falha se o perfil for NULL.
CREATE POLICY "Allow managers/admins to view pending requests" ON public.approval_requests 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
    )
    AND status = 'pending'
);