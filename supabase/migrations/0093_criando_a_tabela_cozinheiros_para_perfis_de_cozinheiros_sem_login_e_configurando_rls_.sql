-- Tabela para armazenar perfis de cozinheiros (sem conta auth.users)
CREATE TABLE public.cozinheiros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- ID do Superadmin/Admin que gerencia
  nome TEXT NOT NULL,
  email TEXT UNIQUE, -- Para contato, não login
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Obrigatório)
ALTER TABLE public.cozinheiros ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso:
-- SELECT: Permitir que qualquer usuário autenticado veja a lista de cozinheiros (para o Kanban)
CREATE POLICY "Allow authenticated users to view all cooks" ON public.cozinheiros 
FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: Apenas Superadmin, Admin e Gerente podem gerenciar cozinheiros
CREATE POLICY "Managers and Admins can manage cooks" ON public.cozinheiros 
FOR ALL TO authenticated USING (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
  IN ('superadmin', 'admin', 'gerente')
) WITH CHECK (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
  IN ('superadmin', 'admin', 'gerente')
);