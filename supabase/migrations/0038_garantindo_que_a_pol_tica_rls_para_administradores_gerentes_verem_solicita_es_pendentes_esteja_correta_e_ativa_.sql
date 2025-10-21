-- 1. Remover a política antiga de SELECT para administradores/gerentes (se existir)
DROP POLICY IF EXISTS "Allow managers/admins to view pending requests" ON public.approval_requests;

-- 2. Recriar a política para garantir que administradores/gerentes/superadmins possam ver TODAS as solicitações pendentes.
CREATE POLICY "Allow managers/admins to view pending requests" ON public.approval_requests 
FOR SELECT TO authenticated USING (
    (status = 'pending'::approval_status) 
    AND (
        (SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) 
        = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
    )
);