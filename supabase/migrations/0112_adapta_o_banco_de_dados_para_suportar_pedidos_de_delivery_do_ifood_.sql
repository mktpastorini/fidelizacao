-- Cria um novo tipo para diferenciar os pedidos
CREATE TYPE public.order_type_enum AS ENUM ('SALAO', 'IFOOD');

-- Altera a tabela de pedidos para incluir as novas colunas
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS order_type public.order_type_enum NOT NULL DEFAULT 'SALAO',
ADD COLUMN IF NOT EXISTS ifood_order_id TEXT,
ADD COLUMN IF NOT EXISTS delivery_details JSONB;

-- Adiciona uma restrição para garantir que cada pedido do iFood seja único
ALTER TABLE public.pedidos
ADD CONSTRAINT unique_ifood_order_id UNIQUE (ifood_order_id);

-- Habilita a segurança de nível de linha (RLS) se ainda não estiver habilitada
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Garante que as políticas existentes permitam o gerenciamento de todos os tipos de pedidos
-- (Esta política é um exemplo, as suas podem ser mais complexas, mas a lógica é a mesma)
DROP POLICY IF EXISTS "Admins and Managers can manage orders" ON public.pedidos;
CREATE POLICY "Admins and Managers can manage orders"
ON public.pedidos
FOR ALL
USING (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]));

DROP POLICY IF EXISTS "Garcom and Balcao can update pedidos" ON public.pedidos;
CREATE POLICY "Garcom and Balcao can update pedidos"
ON public.pedidos
FOR UPDATE
USING (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role]));