-- Tipo ENUM para o status da solicitação
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Tipo ENUM para o tipo de ação
CREATE TYPE approval_action_type AS ENUM ('free_table', 'apply_discount');

-- Tabela de solicitações de aprovação
CREATE TABLE public.approval_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Quem solicitou
  requester_role user_role NOT NULL, -- Função de quem solicitou
  action_type approval_action_type NOT NULL, -- Tipo de ação (liberar mesa, desconto)
  target_id UUID NOT NULL, -- ID do recurso alvo (mesa_id ou item_pedido_id)
  payload JSONB NOT NULL, -- Dados necessários para executar a ação (ex: percentual de desconto)
  status approval_status DEFAULT 'pending'::approval_status NOT NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Quem aprovou/rejeitou
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Obrigatório)
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- 1. Usuários podem criar solicitações (INSERT)
CREATE POLICY "Allow authenticated users to create requests" ON public.approval_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Usuários podem ver suas próprias solicitações (SELECT)
CREATE POLICY "Allow users to view their own requests" ON public.approval_requests
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 3. Admins/Gerentes/Superadmins podem ver todas as solicitações pendentes (SELECT)
CREATE POLICY "Allow managers/admins to view pending requests" ON public.approval_requests
FOR SELECT TO authenticated
USING (
    (status = 'pending'::approval_status) AND 
    (( SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]))
);

-- 4. Admins/Gerentes/Superadmins podem atualizar o status (UPDATE)
CREATE POLICY "Allow managers/admins to update request status" ON public.approval_requests
FOR UPDATE TO authenticated
USING (
    (status = 'pending'::approval_status) AND 
    (( SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]))
)
WITH CHECK (
    (status <> 'pending'::approval_status) AND 
    (auth.uid() = approved_by)
);