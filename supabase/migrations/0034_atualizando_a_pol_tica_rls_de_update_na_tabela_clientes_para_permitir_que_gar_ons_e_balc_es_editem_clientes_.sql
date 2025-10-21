-- 1. Remover a política antiga de UPDATE
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios clientes" ON public.clientes;

-- 2. Criar uma nova política que permite a atualização por garçons/balcões/gerentes/admins
CREATE POLICY "Garcoms and above can update clients" ON public.clientes 
FOR UPDATE TO authenticated USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) IN ('superadmin', 'admin', 'gerente', 'balcao', 'garcom')
);