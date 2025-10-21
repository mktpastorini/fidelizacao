-- Tabela: profiles

-- Remove TODAS as políticas que estamos gerenciando para evitar conflitos
DROP POLICY IF EXISTS "Allow authenticated users to view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles; -- Removendo a política de leitura individual que pode ter sido criada antes

-- Política 1: Permite que usuários autenticados vejam o perfil de outros (necessário para o gerenciamento de usuários)
CREATE POLICY "Allow authenticated users to view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

-- Política 2: Permite que usuários atualizem seu próprio perfil
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Política 3: Permite que apenas superadmins insiram novos perfis (para o gerenciamento de usuários)
CREATE POLICY "Superadmins can insert profiles" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- Política 4: Permite que apenas superadmins deletem perfis
CREATE POLICY "Superadmins can delete profiles" ON public.profiles
FOR DELETE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);


-- Tabela: clientes

-- Remove a política existente de DELETE para clientes
DROP POLICY IF EXISTS "Admins and Managers can delete clients" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios clientes" ON public.clientes;

-- Cria nova política de DELETE: Apenas Admin, Superadmin, Gerente e Balcão podem deletar
CREATE POLICY "Admins and Managers can delete clients" ON public.clientes
FOR DELETE TO authenticated USING (
  (auth.uid() = user_id) AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'gerente', 'balcao')
  )
);