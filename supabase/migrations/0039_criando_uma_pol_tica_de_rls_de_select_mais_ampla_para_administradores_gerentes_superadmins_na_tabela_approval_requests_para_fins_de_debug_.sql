-- 1. Remover a política de SELECT para administradores/gerentes
DROP POLICY IF EXISTS "Allow managers/admins to view pending requests" ON public.approval_requests;

-- 2. Criar uma política mais ampla que permite a leitura de TUDO para administradores/gerentes/superadmins
CREATE POLICY "Superadmins and managers can view all requests" ON public.approval_requests 
FOR SELECT TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) 
    = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])
);