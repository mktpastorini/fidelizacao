-- 1. Cria a tabela cozinheiros se ela não existir
CREATE TABLE IF NOT EXISTS public.cozinheiros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- ID do usuário do estabelecimento (Superadmin)
  nome TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilita RLS (Obrigatório)
ALTER TABLE public.cozinheiros ENABLE ROW LEVEL SECURITY;

-- 3. Adiciona a coluna cozinheiro_id na tabela itens_pedido se ela não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'itens_pedido' 
        AND column_name = 'cozinheiro_id'
    ) THEN
        ALTER TABLE public.itens_pedido ADD COLUMN cozinheiro_id UUID REFERENCES public.cozinheiros(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. RLS Policies: Apenas Gerentes/Admins podem gerenciar (CRUD)
DROP POLICY IF EXISTS "Managers and Admins can manage cooks" ON public.cozinheiros;
CREATE POLICY "Managers and Admins can manage cooks" ON public.cozinheiros 
FOR ALL TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'gerente')
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('superadmin', 'admin', 'gerente')
);

-- 5. RLS Policies: Todos os usuários autenticados podem ver a lista de cozinheiros (para seleção)
DROP POLICY IF EXISTS "Allow authenticated users to view all cooks" ON public.cozinheiros;
CREATE POLICY "Allow authenticated users to view all cooks" ON public.cozinheiros 
FOR SELECT TO authenticated 
USING (true);