-- Remove a política existente que permite a leitura de todos os perfis (se existir)
DROP POLICY IF EXISTS "Allow authenticated users to view all profiles" ON public.profiles;

-- Cria uma nova política para garantir que qualquer usuário autenticado possa ler qualquer perfil
CREATE POLICY "Allow authenticated users to view all profiles" ON public.profiles 
FOR SELECT TO authenticated USING (true);