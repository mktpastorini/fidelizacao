-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Tipos ENUM personalizados
DO $$ BEGIN
  CREATE TYPE public.webhook_delivery_status AS ENUM ('pending', 'delivered', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.template_type AS ENUM ('chegada', 'pagamento', 'geral', 'aniversario');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.produto_tipo AS ENUM ('venda', 'rodizio', 'componente_rodizio');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Inclui 'cancelado' para suportar a lógica de cancelamento de itens
  CREATE TYPE public.item_pedido_status AS ENUM ('pendente', 'preparando', 'entregue', 'cancelado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('superadmin', 'admin', 'gerente', 'balcao', 'garcom', 'cozinha');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

--
-- TABELAS
--

-- Tabela: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  role public.user_role DEFAULT 'garcom'::public.user_role,
  PRIMARY KEY (id)
);

-- Tabela: public.user_settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  webhook_url TEXT,
  chegada_template_id UUID,
  pagamento_template_id UUID,
  api_key TEXT DEFAULT gen_random_uuid(),
  auto_add_item_enabled BOOLEAN DEFAULT FALSE,
  default_produto_id UUID,
  establishment_is_closed BOOLEAN DEFAULT FALSE,
  daily_report_phone_number TEXT,
  auto_close_enabled BOOLEAN DEFAULT FALSE,
  auto_close_time TIME WITHOUT TIME ZONE,
  menu_style TEXT DEFAULT 'sidebar'::TEXT,
  preferred_camera_device_id TEXT,
  compreface_url TEXT,
  compreface_api_key TEXT,
  aniversario_template_id UUID,
  aniversario_horario TIME WITHOUT TIME ZONE DEFAULT '09:00:00'::TIME WITHOUT TIME ZONE,
  n8n_webhook_url TEXT,
  n8n_api_key TEXT,
  login_video_url TEXT
);

-- Tabela: public.clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  casado_com TEXT,
  cliente_desde TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gostos JSONB,
  indicacoes INTEGER DEFAULT 0 NOT NULL,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  avatar_url TEXT,
  indicado_por_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  visitas INTEGER DEFAULT 0 NOT NULL,
  data_nascimento DATE,
  pontos INTEGER DEFAULT 0 NOT NULL
);

-- Tabela: public.filhos
CREATE TABLE IF NOT EXISTS public.filhos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  idade INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: public.categorias
CREATE TABLE IF NOT EXISTS public.categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: public.produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  requer_preparo BOOLEAN DEFAULT TRUE NOT NULL,
  tipo public.produto_tipo DEFAULT 'venda'::public.produto_tipo NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  imagem_url TEXT,
  estoque_atual INTEGER DEFAULT 0 NOT NULL,
  alerta_estoque_baixo INTEGER DEFAULT 0 NOT NULL,
  valor_compra NUMERIC,
  mostrar_no_menu BOOLEAN DEFAULT FALSE,
  pontos_resgate INTEGER
);

-- Tabela: public.mesas
CREATE TABLE IF NOT EXISTS public.mesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  capacidade INTEGER NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: public.mesa_ocupantes
CREATE TABLE IF NOT EXISTS public.mesa_ocupantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mesa_id UUID NOT NULL REFERENCES public.mesas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: public.pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'aberto'::TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  acompanhantes JSONB,
  gorjeta_valor NUMERIC DEFAULT 0,
  garcom_id UUID
);
CREATE INDEX IF NOT EXISTS idx_pedidos_garcom_id ON public.pedidos (garcom_id);

-- Tabela: public.cozinheiros
CREATE TABLE IF NOT EXISTS public.cozinheiros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: public.itens_pedido
CREATE TABLE IF NOT EXISTS public.itens_pedido (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
  nome_produto TEXT NOT NULL,
  quantidade INTEGER DEFAULT 1 NOT NULL,
  preco NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  consumido_por_cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  desconto_percentual NUMERIC DEFAULT 0,
  desconto_motivo TEXT,
  status public.item_pedido_status DEFAULT 'pendente'::public.item_pedido_status NOT NULL,
  requer_preparo BOOLEAN DEFAULT TRUE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cozinheiro_id UUID REFERENCES public.cozinheiros(id) ON DELETE SET NULL,
  hora_inicio_preparo TIMESTAMP WITH TIME ZONE,
  hora_entrega TIMESTAMP WITH TIME ZONE
);

-- Tabela: public.message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo public.template_type DEFAULT 'geral'::public.template_type,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: public.message_logs
CREATE TABLE IF NOT EXISTS public.message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  trigger_event TEXT,
  error_message TEXT,
  webhook_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivery_status public.webhook_delivery_status DEFAULT 'pending'::public.webhook_delivery_status
);

-- Tabela: public.daily_visits
CREATE TABLE IF NOT EXISTS public.daily_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  visit_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, cliente_id, visit_date)
);

-- Tabela: public.approval_requests
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_role public.user_role NOT NULL,
  action_type public.approval_action_type NOT NULL,
  target_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mesa_id_fk UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  item_pedido_id_fk UUID REFERENCES public.itens_pedido(id) ON DELETE SET NULL
);

--
-- RLS POLICIES
--

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins and Managers can update any profile" ON public.profiles FOR UPDATE USING (( SELECT profiles_1.role FROM profiles profiles_1 WHERE (profiles_1.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]));
CREATE POLICY "Superadmins can delete profiles" ON public.profiles FOR DELETE USING (( SELECT profiles_1.role FROM profiles profiles_1 WHERE (profiles_1.id = auth.uid())) = 'superadmin'::user_role);

-- RLS: user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS: clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all clients" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Usuários podem inserir novos clientes para si mesmos" ON public.clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Garcoms and above can update clients" ON public.clientes FOR UPDATE USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role, 'balcao'::user_role, 'garcom'::user_role]));
CREATE POLICY "Admins and Managers can delete clients" ON public.clientes FOR DELETE USING ((auth.uid() = user_id) AND (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role, 'balcao'::user_role])));
CREATE POLICY "Public read access for clients on occupied tables" ON public.clientes FOR SELECT USING ((EXISTS ( SELECT 1 FROM mesa_ocupantes mo WHERE (mo.cliente_id = clientes.id))) AND (user_id IN ( SELECT m.user_id FROM (mesas m JOIN mesa_ocupantes mo ON ((m.id = mo.mesa_id))) WHERE (mo.cliente_id = clientes.id))));

-- RLS: filhos
ALTER TABLE public.filhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem gerenciar os filhos de seus próprios clientes" ON public.filhos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS: categorias
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all categories" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Allow managers and admins to manage categories" ON public.categorias FOR ALL TO authenticated USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])) WITH CHECK (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]));
CREATE POLICY "Public read access for categories" ON public.categorias FOR SELECT USING (true);

-- RLS: produtos
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all products" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Allow managers and admins to manage products" ON public.produtos FOR ALL TO authenticated USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])) WITH CHECK (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]));
CREATE POLICY "Public read access for menu products" ON public.produtos FOR SELECT USING (mostrar_no_menu = true);

-- RLS: mesas
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all mesas" ON public.mesas FOR SELECT USING (true);
CREATE POLICY "Admins and Managers can manage mesas" ON public.mesas FOR ALL TO authenticated USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])) WITH CHECK (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]));
CREATE POLICY "Garcom and Balcao can update mesa client_id" ON public.mesas FOR UPDATE USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role]));
CREATE POLICY "Public read access for menu" ON public.mesas FOR SELECT USING (true);

-- RLS: mesa_ocupantes
ALTER TABLE public.mesa_ocupantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to manage mesa occupants" ON public.mesa_ocupantes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Garcom and Balcao can select mesa occupants" ON public.mesa_ocupantes FOR SELECT USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role, 'gerente'::user_role, 'admin'::user_role, 'superadmin'::user_role]));
CREATE POLICY "Garcom and Balcao can insert mesa occupants" ON public.mesa_ocupantes FOR INSERT WITH CHECK (true);
CREATE POLICY "Garcom and Balcao can delete mesa occupants" ON public.mesa_ocupantes FOR DELETE USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role]));
CREATE POLICY "Public read access for mesa occupants" ON public.mesa_ocupantes FOR SELECT USING (EXISTS ( SELECT 1 FROM mesas m WHERE ((m.id = mesa_ocupantes.mesa_id) AND (m.cliente_id IS NOT NULL))));

-- RLS: pedidos
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all orders" ON public.pedidos FOR SELECT USING (true);
CREATE POLICY "Admins and Managers can manage orders" ON public.pedidos FOR ALL TO authenticated USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])) WITH CHECK (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]));
CREATE POLICY "Staff can insert orders" ON public.pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Garcom and Balcao can update pedido client and companions" ON public.pedidos FOR UPDATE USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role]));
CREATE POLICY "Public read access for open orders by mesa_id" ON public.pedidos FOR SELECT USING (status = 'aberto'::text);

-- RLS: cozinheiros
ALTER TABLE public.cozinheiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all cooks" ON public.cozinheiros FOR SELECT USING (true);
CREATE POLICY "Managers and Admins can manage cooks" ON public.cozinheiros FOR ALL TO authenticated USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])) WITH CHECK (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role]));

-- RLS: itens_pedido
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to view all order items" ON public.itens_pedido FOR SELECT USING (true);
CREATE POLICY "Staff can insert order items" ON public.itens_pedido FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins and Managers can update item status" ON public.itens_pedido FOR UPDATE USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role, 'cozinha'::user_role]));
CREATE POLICY "Garcom and Balcao can update order items" ON public.itens_pedido FOR UPDATE USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role]));
CREATE POLICY "Garcom and Balcao can delete order items" ON public.itens_pedido FOR DELETE USING (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role]));
CREATE POLICY "Garcom and Balcao can mark non-prep items as delivered" ON public.itens_pedido FOR UPDATE USING ((( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::user_role, 'balcao'::user_role])) AND (requer_preparo = false));
CREATE POLICY "Public read access for order items via open order" ON public.itens_pedido FOR SELECT USING (EXISTS ( SELECT 1 FROM pedidos WHERE ((pedidos.id = itens_pedido.pedido_id) AND (pedidos.status = 'aberto'::text))));
CREATE POLICY "Cozinheiros can update their own items" ON public.itens_pedido FOR UPDATE USING (auth.uid() = ( SELECT cozinheiros.user_id FROM cozinheiros WHERE (cozinheiros.id = itens_pedido.cozinheiro_id)));

-- RLS: message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own templates" ON public.message_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow authenticated users to view all templates" ON public.message_templates FOR SELECT USING (true);

-- RLS: message_logs
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own message logs" ON public.message_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own message logs" ON public.message_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow authenticated users to view all message logs" ON public.message_logs FOR SELECT USING (true);

-- RLS: daily_visits
ALTER TABLE public.daily_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own daily visits" ON public.daily_visits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS: approval_requests
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own requests" ON public.approval_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to view their own requests" ON public.approval_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow managers/admins to view all requests" ON public.approval_requests FOR SELECT USING (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])))));
CREATE POLICY "Allow managers/admins to update request status" ON public.approval_requests FOR UPDATE USING ((status = 'pending'::approval_status) AND (( SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role])));

--
-- FUNÇÕES (RPC e Triggers)
--

CREATE OR REPLACE FUNCTION public.vector_recv(internal, oid, integer)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_recv$function$;

CREATE OR REPLACE FUNCTION public.vector_out(vector)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_out$function$;

CREATE OR REPLACE FUNCTION public.vector_ne(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_ne$function$;

CREATE OR REPLACE FUNCTION public.hamming_distance(bit, bit)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$hamming_distance$function$;

CREATE OR REPLACE FUNCTION public.l1_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l1_distance$function$;

CREATE OR REPLACE FUNCTION public.handle_pedido_pago_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    cliente_id_atual UUID;
    acompanhante_record RECORD;
BEGIN
    -- 1. Verifica se o status mudou para 'pago'
    IF NEW.status = 'pago' AND OLD.status <> 'pago' THEN
        
        -- 2. Adiciona 1 ponto ao cliente principal (se existir)
        IF NEW.cliente_id IS NOT NULL THEN
            UPDATE public.clientes
            SET pontos = pontos + 1
            WHERE id = NEW.cliente_id;
        END IF;

        -- 3. Itera sobre a lista de acompanhantes (se existir) e adiciona 1 ponto a cada um
        IF NEW.acompanhantes IS NOT NULL THEN
            FOR acompanhante_record IN
                SELECT (jsonb_array_elements(NEW.acompanhantes)->>'id')::uuid AS id
            LOOP
                -- Garante que o acompanhante não seja o cliente principal (evita duplicidade se o principal estiver na lista)
                IF acompanhante_record.id IS NOT NULL AND acompanhante_record.id <> NEW.cliente_id THEN
                    UPDATE public.clientes
                    SET pontos = pontos + 1
                    WHERE id = acompanhante_record.id;
                END IF;
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_todays_birthdays_by_user(p_user_id uuid)
 RETURNS TABLE(id uuid, nome text, whatsapp text, data_nascimento date, gostos jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    -- Define a data de referência como a data atual em Brasília (UTC - 3 horas)
    today_br DATE := (NOW() AT TIME ZONE 'UTC' - interval '3 hour')::date;
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.nome,
        c.whatsapp,
        c.data_nascimento,
        c.gostos
    FROM 
        public.clientes c
    WHERE 
        c.user_id = p_user_id
        AND c.data_nascimento IS NOT NULL
        -- Compara o mês e o dia da data de nascimento com o mês e o dia da data de referência (Brasília)
        AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM today_br)
        AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM today_br);
END;
$function$;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(double precision[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_in(cstring, oid, integer)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_in$function$;

CREATE OR REPLACE FUNCTION public.l1_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l1_distance$function$;

CREATE OR REPLACE FUNCTION public.vector_to_sparsevec(vector, integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_to_sparsevec$function$;

CREATE OR REPLACE FUNCTION public.get_cook_performance_details(p_user_id uuid, p_cozinheiro_id uuid, start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(item_id uuid, nome_produto text, mesa_numero integer, hora_inicio_preparo timestamp with time zone, hora_entrega timestamp with time zone, tempo_conclusao_min numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT
        ip.id AS item_id,
        ip.nome_produto,
        m.numero AS mesa_numero,
        ip.hora_inicio_preparo,
        ip.hora_entrega,
        COALESCE(
            EXTRACT(EPOCH FROM (ip.hora_entrega - ip.hora_inicio_preparo)) / 60,
            0
        )::numeric AS tempo_conclusao_min
    FROM
        public.itens_pedido ip
    JOIN
        public.pedidos p ON ip.pedido_id = p.id
    JOIN
        public.mesas m ON p.mesa_id = m.id
    WHERE
        ip.user_id = p_user_id
        AND ip.cozinheiro_id = p_cozinheiro_id
        AND ip.status = 'entregue'
        AND ip.requer_preparo = TRUE
        AND ip.hora_entrega BETWEEN start_date AND end_date
    ORDER BY
        ip.hora_entrega DESC;
$function$;

CREATE OR REPLACE FUNCTION public.vector(vector, integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector$function$;

CREATE OR REPLACE FUNCTION public.get_financial_stats_today()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    revenue_today_calc numeric;
    closed_orders_today_count int;
    avg_ticket_today_calc numeric;
    user_id_val uuid := auth.uid();
BEGIN
    -- Calcular faturamento de hoje
    SELECT COALESCE(sum(ip.preco * ip.quantidade), 0)
    INTO revenue_today_calc
    FROM public.pedidos p
    JOIN public.itens_pedido ip ON p.id = ip.pedido_id
    WHERE p.user_id = user_id_val
      AND p.status = 'pago'
      AND p.closed_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
      AND p.closed_at < date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day';

    -- Contar pedidos fechados hoje para o ticket médio
    SELECT count(DISTINCT p.id)
    INTO closed_orders_today_count
    FROM public.pedidos p
    WHERE p.user_id = user_id_val
      AND p.status = 'pago'
      AND p.closed_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
      AND p.closed_at < date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day';

    -- Calcular ticket médio, evitando divisão por zero
    IF closed_orders_today_count > 0 THEN
        avg_ticket_today_calc := revenue_today_calc / closed_orders_today_count;
    ELSE
        avg_ticket_today_calc := 0;
    END IF;

    -- Retornar os resultados como um objeto JSON
    RETURN json_build_object(
        'revenue_today', revenue_today_calc,
        'avg_ticket_today', avg_ticket_today_calc
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.halfvec_avg(double precision[])
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_avg$function$;

CREATE OR REPLACE FUNCTION public.get_low_stock_products()
 RETURNS TABLE(id uuid, nome text, estoque_atual integer, alerta_estoque_baixo integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    p.id,
    p.nome,
    p.estoque_atual,
    p.alerta_estoque_baixo
  FROM
    public.produtos p
  WHERE
    p.user_id = auth.uid()
    AND p.estoque_atual <= p.alerta_estoque_baixo
    AND p.estoque_atual > 0; -- Exclui itens esgotados (estoque 0)
$function$;

CREATE OR REPLACE FUNCTION public.array_to_vector(integer[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$;

CREATE OR REPLACE FUNCTION public.match_customer_face(query_embedding vector, match_threshold double precision, match_count integer, provider text)
 RETURNS TABLE(cliente_id uuid, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    cf.cliente_id,
    1 - (cf.embedding <=> query_embedding) AS similarity
  FROM
    public.customer_faces cf
  WHERE 
    cf.ai_provider = provider
    AND 1 - (cf.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.hnsw_bit_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$hnsw_bit_support$function$;

CREATE OR REPLACE FUNCTION public.vector_concat(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_concat$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_le(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_le$function$;

CREATE OR REPLACE FUNCTION public.inner_product(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$inner_product$function$;

CREATE OR REPLACE FUNCTION public.array_to_vector(double precision[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$;

CREATE OR REPLACE FUNCTION public.get_recent_arrivals(limit_count integer)
 RETURNS TABLE(cliente_id uuid, nome text, avatar_url text, arrival_time timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id as cliente_id,
        c.nome,
        c.avatar_url,
        p.created_at as arrival_time
    FROM
        public.pedidos p
    JOIN
        public.clientes c ON p.cliente_id = c.id
    WHERE
        p.user_id = auth.uid()
    ORDER BY
        p.created_at DESC
    LIMIT
        limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vector_in(cstring, oid, integer)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_in$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_send(sparsevec)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_send$function$;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(double precision[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$;

CREATE OR REPLACE FUNCTION public.halfvec_mul(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_mul$function$;

CREATE OR REPLACE FUNCTION public.handle_new_occupant_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_settings record;
    v_produto record;
    v_pedido_id uuid;
    v_nome_final text;
    v_requer_preparo boolean;
BEGIN
    -- Encontra o user_id associado à mesa
    SELECT user_id INTO v_user_id FROM public.mesas WHERE id = NEW.mesa_id;

    -- Busca as configurações do usuário
    SELECT auto_add_item_enabled, default_produto_id
    INTO v_settings
    FROM public.user_settings
    WHERE id = v_user_id;

    -- Se a funcionalidade estiver habilitada e um produto padrão definido
    IF v_settings.auto_add_item_enabled AND v_settings.default_produto_id IS NOT NULL THEN
        -- Busca os detalhes do produto padrão
        SELECT nome, preco, tipo, requer_preparo INTO v_produto FROM public.produtos WHERE id = v_settings.default_produto_id;

        -- Determina o nome final e se requer preparo
        v_nome_final := v_produto.nome;
        v_requer_preparo := v_produto.requer_preparo;

        -- Se for um Pacote Rodízio (o custo fixo), prefixamos e garantimos que não requer preparo.
        IF v_produto.tipo = 'rodizio' THEN
            v_nome_final := '[RODIZIO] ' || v_produto.nome;
            v_requer_preparo := FALSE; 
        -- Se for um Item de Rodízio (componente), ele não deve ser prefixado, mas garantimos que não requer preparo (conforme a regra de negócio).
        ELSIF v_produto.tipo = 'componente_rodizio' THEN
            v_requer_preparo := FALSE;
        END IF;

        -- Encontra o pedido aberto para a mesa
        SELECT id INTO v_pedido_id FROM public.pedidos WHERE mesa_id = NEW.mesa_id AND status = 'aberto';

        -- Se houver um pedido aberto e um produto válido, insere o item
        IF v_pedido_id IS NOT NULL AND v_produto IS NOT NULL THEN
            INSERT INTO public.itens_pedido (pedido_id, user_id, nome_produto, preco, quantidade, consumido_por_cliente_id, requer_preparo)
            VALUES (v_pedido_id, v_user_id, v_nome_final, v_produto.preco, 1, NEW.cliente_id, v_requer_preparo);
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(integer[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$;

CREATE OR REPLACE FUNCTION public.create_client_with_referral(p_user_id uuid, p_nome text, p_casado_com text, p_whatsapp text, p_gostos jsonb, p_avatar_url text, p_indicado_por_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    new_cliente_id uuid;
BEGIN
    -- Insere o novo cliente
    INSERT INTO public.clientes (user_id, nome, casado_com, whatsapp, gostos, avatar_url, indicado_por_id)
    VALUES (p_user_id, p_nome, p_casado_com, p_whatsapp, p_gostos, p_avatar_url, p_indicado_por_id)
    RETURNING id INTO new_cliente_id;

    -- Se um indicador foi fornecido, atualiza a contagem de indicações dele
    IF p_indicado_por_id IS NOT NULL THEN
        UPDATE public.clientes
        SET indicacoes = indicacoes + 1
        WHERE id = p_indicado_por_id;
    END IF;

    RETURN new_cliente_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.l1_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$l1_distance$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vector_dims(halfvec)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_vector_dims$function$;

CREATE OR REPLACE FUNCTION public.process_free_table_request(p_request_id uuid, p_approved_by uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_mesa_id UUID;
    v_open_order_id UUID;
    v_cancelled_items JSONB := '[]'::jsonb;
    v_occupants_json JSONB := '[]'::jsonb;
    v_mesa_numero INTEGER;
    v_can_be_freed BOOLEAN;
    v_cliente_principal_id UUID;
    v_acompanhantes_raw JSONB;
    v_pending_item_ids UUID[]; -- Nova variável para armazenar IDs
BEGIN
    -- 1. Buscar a solicitação pendente
    SELECT target_id, payload->>'mesa_numero' INTO v_mesa_id, v_mesa_numero
    FROM public.approval_requests
    WHERE id = p_request_id AND status = 'pending' AND action_type = 'free_table';

    IF v_mesa_id IS NULL THEN
        RAISE EXCEPTION 'Solicitação não encontrada ou já processada.';
    END IF;

    -- 2. Verificar se a mesa pode ser liberada (se não houver itens em preparo)
    SELECT public.check_mesa_can_be_freed(v_mesa_id) INTO v_can_be_freed;

    IF NOT v_can_be_freed THEN
        RAISE EXCEPTION 'Mesa % não pode ser liberada: existem itens em preparo.', v_mesa_numero;
    END IF;

    -- 3. Tenta encontrar o pedido aberto e o cliente principal
    SELECT id, cliente_id, acompanhantes INTO v_open_order_id, v_cliente_principal_id, v_acompanhantes_raw
    FROM public.pedidos
    WHERE mesa_id = v_mesa_id AND status = 'aberto'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se o pedido foi encontrado, atualiza a lista de ocupantes para o payload de auditoria
    IF v_open_order_id IS NOT NULL THEN
        v_occupants_json := COALESCE(v_acompanhantes_raw, '[]'::jsonb);
        
        -- 4. Cancelar itens pendentes do cliente principal (se houver um cliente principal no pedido)
        IF v_cliente_principal_id IS NOT NULL THEN
            
            -- 4a. Coletar os itens pendentes e seus IDs
            WITH pending_items AS (
                SELECT id, nome_produto, quantidade, preco, desconto_percentual, desconto_motivo
                FROM public.itens_pedido
                WHERE pedido_id = v_open_order_id
                  AND status = 'pendente'
                  AND consumido_por_cliente_id = v_cliente_principal_id
            )
            -- Coletar itens cancelados para o payload E os IDs para a atualização
            SELECT jsonb_agg(row_to_json(pi)), ARRAY_AGG(pi.id)
            INTO v_cancelled_items, v_pending_item_ids
            FROM pending_items pi;

            -- Garante que v_cancelled_items é um array JSONB
            v_cancelled_items := COALESCE(v_cancelled_items, '[]'::jsonb);

            -- 4b. Atualizar status dos itens pendentes para 'cancelado' usando os IDs coletados
            IF array_length(v_pending_item_ids, 1) > 0 THEN
                UPDATE public.itens_pedido
                SET status = 'cancelado'
                WHERE id = ANY(v_pending_item_ids);
            END IF;
        END IF;

        -- 5. Verificar se restaram itens no pedido (itens da mesa geral ou de acompanhantes)
        PERFORM 1 FROM public.itens_pedido WHERE pedido_id = v_open_order_id LIMIT 1;

        IF NOT FOUND THEN
            -- Se não restou nada, cancela o pedido principal
            UPDATE public.pedidos SET status = 'pago', closed_at = NOW() WHERE id = v_open_order_id;
        END IF;
    END IF;

    -- 6. Libera a mesa e remove ocupantes
    UPDATE public.mesas SET cliente_id = NULL WHERE id = v_mesa_id;
    DELETE FROM public.mesa_ocupantes WHERE mesa_id = v_mesa_id;

    -- 7. Atualizar a solicitação como aprovada, incluindo a lista de ocupantes no payload para auditoria
    UPDATE public.approval_requests
    SET 
        status = 'approved', 
        approved_by = p_approved_by, 
        approved_at = NOW(),
        payload = jsonb_set(
            jsonb_set(payload, '{cancelled_items}', v_cancelled_items),
            '{occupants_at_cancellation}', v_occupants_json
        )
    WHERE id = p_request_id;

    RETURN json_build_object('success', TRUE, 'message', 'Mesa liberada e itens pendentes do cliente principal cancelados.');
END;
$function$;

CREATE OR REPLACE FUNCTION public.vector_mul(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_mul$function$;

CREATE OR REPLACE FUNCTION public.l2_normalize(halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_normalize$function$;

CREATE OR REPLACE FUNCTION public.halfvec_to_vector(halfvec, integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_to_vector$function$;

CREATE OR REPLACE FUNCTION public.halfvec_recv(internal, oid, integer)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_recv$function$;

CREATE OR REPLACE FUNCTION public.ivfflathandler(internal)
 RETURNS index_am_handler
 LANGUAGE c
AS '$libdir/vector', $function$ivfflathandler$function$;

CREATE OR REPLACE FUNCTION public.get_todays_birthdays()
 RETURNS TABLE(nome text, whatsapp text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    -- Define a data de referência como a data atual em Brasília (UTC - 3 horas)
    today_br DATE := (NOW() AT TIME ZONE 'UTC' - interval '3 hour')::date;
BEGIN
    RETURN QUERY
    SELECT 
        c.nome,
        c.whatsapp
    FROM 
        public.clientes c
    WHERE 
        c.user_id = auth.uid()
        AND c.data_nascimento IS NOT NULL
        -- Compara o mês e o dia da data de nascimento com o mês e o dia da data de referência (Brasília)
        AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM today_br)
        AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM today_br);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sparsevec(sparsevec, integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec$function$;

CREATE OR REPLACE FUNCTION public.subvector(vector, integer, integer)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$subvector$function$;

CREATE OR REPLACE FUNCTION public.cosine_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_cosine_distance$function$;

CREATE OR REPLACE FUNCTION public.l2_normalize(vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$l2_normalize$function$;

CREATE OR REPLACE FUNCTION public.vector_accum(double precision[], vector)
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_accum$function$;

CREATE OR REPLACE FUNCTION public.halfvec_typmod_in(cstring[])
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_typmod_in$function$;

CREATE OR REPLACE FUNCTION public.binary_quantize(vector)
 RETURNS bit
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$binary_quantize$function$;

CREATE OR REPLACE FUNCTION public.l2_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$l2_distance$function$;

CREATE OR REPLACE FUNCTION public.halfvec_eq(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_eq$function$;

CREATE OR REPLACE FUNCTION public.halfvec_ge(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_ge$function$;

CREATE OR REPLACE FUNCTION public.get_tip_stats(p_user_id uuid, start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(garcom_id uuid, garcom_nome text, total_gorjetas numeric, total_pedidos bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT
        p.garcom_id,
        (SELECT pr.first_name || ' ' || pr.last_name FROM public.profiles pr WHERE pr.id = p.garcom_id) AS garcom_nome,
        COALESCE(SUM(p.gorjeta_valor), 0) AS total_gorjetas,
        COUNT(p.id) AS total_pedidos
    FROM
        public.pedidos p
    WHERE
        p.user_id = p_user_id
        AND p.status = 'pago'
        AND p.garcom_id IS NOT NULL
        AND p.closed_at BETWEEN start_date AND end_date
    GROUP BY
        p.garcom_id
    ORDER BY
        total_gorjetas DESC;
$function$;

CREATE OR REPLACE FUNCTION public.halfvec_lt(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_lt$function$;

CREATE OR REPLACE FUNCTION public.halfvec_send(halfvec)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_send$function$;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(integer[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$;

CREATE OR REPLACE FUNCTION public.vector_le(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_le$function$;

CREATE OR REPLACE FUNCTION public.halfvec(halfvec, integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec$function$;

CREATE OR REPLACE FUNCTION public.l2_norm(sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_norm$function$;

CREATE OR REPLACE FUNCTION public.vector_to_halfvec(vector, integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_to_halfvec$function$;

CREATE OR REPLACE FUNCTION public.match_customer_face(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(cliente_id uuid, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    cf.cliente_id,
    1 - (cf.embedding <=> query_embedding) AS similarity
  FROM
    public.customer_faces cf
  WHERE 1 - (cf.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.vector_typmod_in(cstring[])
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_typmod_in$function$;

CREATE OR REPLACE FUNCTION public.vector_spherical_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_spherical_distance$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_to_vector(sparsevec, integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_to_vector$function$;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(real[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$;

CREATE OR REPLACE FUNCTION public.vector_add(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_add$function$;

CREATE OR REPLACE FUNCTION public.l2_norm(halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_norm$function$;

CREATE OR REPLACE FUNCTION public.ivfflat_halfvec_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$ivfflat_halfvec_support$function$;

CREATE OR REPLACE FUNCTION public.ivfflat_bit_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$ivfflat_bit_support$function$;

CREATE OR REPLACE FUNCTION public.handle_new_visit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    -- Tenta inserir um novo registro de visita. Se já existir para o dia, não faz nada.
    -- A CTE 'new_visit' captura o 'id' apenas se uma nova linha for inserida.
    WITH new_visit AS (
        INSERT INTO public.daily_visits (user_id, cliente_id, visit_date)
        VALUES (NEW.user_id, NEW.cliente_id, CURRENT_DATE)
        ON CONFLICT (user_id, cliente_id, visit_date) DO NOTHING
        RETURNING id
    )
    -- Atualiza o contador de visitas do cliente somente se uma nova visita foi registrada (o id não é nulo).
    UPDATE public.clientes
    SET visitas = visitas + 1
    WHERE id = NEW.cliente_id AND EXISTS (SELECT 1 FROM new_visit WHERE id IS NOT NULL);

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cosine_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_cosine_distance$function$;

CREATE OR REPLACE FUNCTION public.halfvec_to_sparsevec(halfvec, integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_to_sparsevec$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_ge(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_ge$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_ne(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_ne$function$;

CREATE OR REPLACE FUNCTION public.halfvec_combine(double precision[], double precision[])
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_combine$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_l2_squared_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_squared_distance$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_eq(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_eq$function$;

CREATE OR REPLACE FUNCTION public.hnsw_halfvec_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$hnsw_halfvec_support$function$;

CREATE OR REPLACE FUNCTION public.jaccard_distance(bit, bit)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$jaccard_distance$function$;

CREATE OR REPLACE FUNCTION public.halfvec_sub(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_sub$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_lt(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_lt$function$;

CREATE OR REPLACE FUNCTION public.halfvec_out(halfvec)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_out$function$;

CREATE OR REPLACE FUNCTION public.vector_avg(double precision[])
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_avg$function$;

CREATE OR REPLACE FUNCTION public.vector_eq(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_eq$function$;

CREATE OR REPLACE FUNCTION public.get_cook_performance_stats(p_user_id uuid, start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(cozinheiro_id uuid, cozinheiro_nome text, total_pratos_finalizados bigint, tempo_medio_preparo_min numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT
        ip.cozinheiro_id,
        (SELECT c.nome FROM public.cozinheiros c WHERE c.id = ip.cozinheiro_id) AS cozinheiro_nome,
        COUNT(ip.id) AS total_pratos_finalizados,
        COALESCE(
            AVG(EXTRACT(EPOCH FROM (ip.hora_entrega - ip.hora_inicio_preparo)) / 60),
            0
        )::numeric AS tempo_medio_preparo_min
    FROM
        public.itens_pedido ip
    WHERE
        ip.user_id = p_user_id
        AND ip.status = 'entregue'
        AND ip.requer_preparo = TRUE -- Apenas itens que realmente foram preparados
        AND ip.hora_entrega BETWEEN start_date AND end_date
        AND ip.cozinheiro_id IS NOT NULL
    GROUP BY
        ip.cozinheiro_id
    ORDER BY
        total_pratos_finalizados DESC;
$function$;

CREATE OR REPLACE FUNCTION public.cosine_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$cosine_distance$function$;

CREATE OR REPLACE FUNCTION public.array_to_halfvec(numeric[], integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_halfvec$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_to_halfvec(sparsevec, integer, boolean)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_to_halfvec$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_typmod_in(cstring[])
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_typmod_in$function$;

CREATE OR REPLACE FUNCTION public.subvector(halfvec, integer, integer)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_subvector$function$;

CREATE OR REPLACE FUNCTION public.vector_lt(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_lt$function$;

CREATE OR REPLACE FUNCTION public.halfvec_add(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_add$function$;

CREATE OR REPLACE FUNCTION public.vector_negative_inner_product(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_negative_inner_product$function$;

CREATE OR REPLACE FUNCTION public.l2_normalize(sparsevec)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_normalize$function$;

CREATE OR REPLACE FUNCTION public.vector_sub(vector, vector)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_sub$function$;

CREATE OR REPLACE FUNCTION public.halfvec_le(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_le$function$;

CREATE OR REPLACE FUNCTION public.get_top_clients_by_visits(limit_count integer, days_period integer)
 RETURNS TABLE(cliente_id uuid, nome text, avatar_url text, visit_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF days_period > 0 THEN
        -- Se um período de dias for especificado, conta as visitas na tabela daily_visits.
        RETURN QUERY
        SELECT
            c.id as cliente_id,
            c.nome,
            c.avatar_url,
            COUNT(dv.id) as visit_count
        FROM
            public.daily_visits dv
        JOIN
            public.clientes c ON dv.cliente_id = c.id
        WHERE
            dv.user_id = auth.uid()
            AND dv.visit_date >= (NOW() - (days_period || ' days')::interval)::date
        GROUP BY
            c.id, c.nome, c.avatar_url
        ORDER BY
            visit_count DESC
        LIMIT
            limit_count;
    ELSE
        -- Se nenhum período for especificado (days_period = 0), usa a contagem total da tabela clientes.
        RETURN QUERY
        SELECT
            c.id as cliente_id,
            c.nome,
            c.avatar_url,
            c.visitas::bigint as visit_count
        FROM
            public.clientes c
        WHERE
            c.user_id = auth.uid()
        ORDER BY
            visit_count DESC
        LIMIT
            limit_count;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_out(sparsevec)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_out$function$;

CREATE OR REPLACE FUNCTION public.get_daily_revenue(days_to_check integer)
 RETURNS TABLE(day date, total_revenue numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            (now() AT TIME ZONE 'UTC' - (days_to_check - 1) * interval '1 day')::date,
            (now() AT TIME ZONE 'UTC')::date,
            '1 day'::interval
        )::date AS day
    )
    SELECT
        ds.day,
        COALESCE(sum(ip.preco * ip.quantidade), 0) AS total_revenue
    FROM date_series ds
    LEFT JOIN public.pedidos p ON date_trunc('day', p.closed_at AT TIME ZONE 'UTC') = ds.day
        AND p.status = 'pago'
        AND p.user_id = auth.uid()
    LEFT JOIN public.itens_pedido ip ON ip.pedido_id = p.id
    GROUP BY ds.day
    ORDER BY ds.day ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.binary_quantize(halfvec)
 RETURNS bit
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_binary_quantize$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_cmp(sparsevec, sparsevec)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_cmp$function$;

CREATE OR REPLACE FUNCTION public.get_top_clients(limit_count integer)
 RETURNS TABLE(cliente_id uuid, nome text, avatar_url text, total_gasto numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id as cliente_id,
        c.nome,
        c.avatar_url,
        SUM(ip.preco * ip.quantidade) as total_gasto
    FROM
        public.pedidos p
    JOIN
        public.itens_pedido ip ON p.id = ip.pedido_id
    JOIN
        public.clientes c ON p.cliente_id = c.id
    WHERE
        p.status = 'pago' AND p.user_id = auth.uid()
    GROUP BY
        c.id, c.nome, c.avatar_url
    ORDER BY
        total_gasto DESC
    LIMIT
        limit_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_mesa_can_be_freed(p_mesa_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.pedidos p
    JOIN public.itens_pedido ip ON p.id = ip.pedido_id
    WHERE p.mesa_id = p_mesa_id
      AND p.status = 'aberto'
      AND ip.status = 'preparando'
  );
$function$;

CREATE OR REPLACE FUNCTION public.array_to_vector(real[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(numeric[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$;

CREATE OR REPLACE FUNCTION public.halfvec_cmp(halfvec, halfvec)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_cmp$function$;

CREATE OR REPLACE FUNCTION public.halfvec_concat(halfvec, halfvec)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_concat$function$;

CREATE OR REPLACE FUNCTION public.vector_combine(double precision[], double precision[])
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_combine$function$;

CREATE OR REPLACE FUNCTION public.vector_gt(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_gt$function$;

CREATE OR REPLACE FUNCTION public.halfvec_l2_squared_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_squared_distance$function$;

CREATE OR REPLACE FUNCTION public.vector_send(vector)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_send$function$;

CREATE OR REPLACE FUNCTION public.vector_cmp(vector, vector)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_cmp$function$;

CREATE OR REPLACE FUNCTION public.match_face(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(cliente_id uuid, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    cf.cliente_id,
    1 - (cf.embedding <=> query_embedding) AS similarity
  FROM
    public.customer_faces cf
  WHERE 1 - (cf.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.halfvec_spherical_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_spherical_distance$function$;

CREATE OR REPLACE FUNCTION public.array_to_vector(numeric[], integer, boolean)
 RETURNS vector
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_vector$function$;

CREATE OR REPLACE FUNCTION public.inner_product(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_inner_product$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_negative_inner_product(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_negative_inner_product$function$;

CREATE OR REPLACE FUNCTION public.halfvec_ne(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_ne$function$;

CREATE OR REPLACE FUNCTION public.array_to_sparsevec(real[], integer, boolean)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$array_to_sparsevec$function$;

CREATE OR REPLACE FUNCTION public.vector_to_float4(vector, integer, boolean)
 RETURNS real[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_to_float4$function$;

CREATE OR REPLACE FUNCTION public.inner_product(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_inner_product$function$;

CREATE OR REPLACE FUNCTION public.halfvec_in(cstring, oid, integer)
 RETURNS halfvec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_in$function$;

CREATE OR REPLACE FUNCTION public.finalizar_pagamento_total(p_pedido_id uuid, p_mesa_id uuid)
 RETURNS TABLE(message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_cliente_id uuid;
    v_acompanhantes jsonb;
    v_new_pedido_id uuid;
    v_total_items_remaining integer;
BEGIN
    -- 1. Obter informações essenciais do pedido aberto
    SELECT user_id, cliente_id, acompanhantes
    INTO v_user_id, v_cliente_id, v_acompanhantes
    FROM public.pedidos
    WHERE id = p_pedido_id AND status = 'aberto';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido aberto não encontrado para o ID especificado (%).', p_pedido_id;
    END IF;

    -- Se o pedido não tem cliente principal, usamos o cliente da mesa (se houver) ou levantamos exceção
    IF v_cliente_id IS NULL THEN
        SELECT cliente_id INTO v_cliente_id FROM public.mesas WHERE id = p_mesa_id;
        IF v_cliente_id IS NULL THEN
            RAISE EXCEPTION 'Não é possível finalizar a conta total: O pedido não tem cliente principal e a mesa está desocupada.';
        END IF;
    END IF;

    -- 2. Obter o ID do usuário logado
    SELECT auth.uid() INTO v_user_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- 3. Criar um novo pedido "recibo" (status 'pago') para o cliente principal
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, mesa_id, acompanhantes, gorjeta_valor, garcom_id)
    VALUES (v_user_id, v_cliente_id, 'pago', NOW(), p_mesa_id, v_acompanhantes, (SELECT gorjeta_valor FROM public.pedidos WHERE id = p_pedido_id), (SELECT garcom_id FROM public.pedidos WHERE id = p_pedido_id))
    RETURNING id INTO v_new_pedido_id;

    -- 4. Mover TODOS os itens restantes do pedido original para o novo pedido de recibo
    -- E atribuir o consumido_por_cliente_id ao cliente principal (v_cliente_id) se for nulo (Mesa Geral)
    UPDATE public.itens_pedido
    SET 
        pedido_id = v_new_pedido_id,
        consumido_por_cliente_id = COALESCE(consumido_por_cliente_id, v_cliente_id), -- Atribui Mesa Geral ao cliente principal
        updated_at = NOW()
    WHERE pedido_id = p_pedido_id;

    -- 5. Fechar o pedido original (que agora está vazio)
    UPDATE public.pedidos
    SET status = 'pago', closed_at = NOW()
    WHERE id = p_pedido_id;

    -- 6. Liberar a mesa (remove cliente_id e todos os ocupantes)
    UPDATE public.mesas
    SET cliente_id = NULL
    WHERE id = p_mesa_id;

    DELETE FROM public.mesa_ocupantes
    WHERE mesa_id = p_mesa_id;

    RETURN QUERY SELECT 'Conta total finalizada e mesa liberada.' AS message;
END;
$function$;

CREATE OR REPLACE FUNCTION public.l2_distance(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_l2_distance$function$;

CREATE OR REPLACE FUNCTION public.vector_l2_squared_distance(vector, vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_l2_squared_distance$function$;

CREATE OR REPLACE FUNCTION public.vector_dims(vector)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_dims$function$;

CREATE OR REPLACE FUNCTION public.halfvec_to_float4(halfvec, integer, boolean)
 RETURNS real[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_to_float4$function$;

CREATE OR REPLACE FUNCTION public.get_stats_by_date_range_for_user(p_user_id uuid, start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(total_revenue numeric, total_orders bigint, avg_order_value numeric, new_clients bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    WITH
    order_totals AS (
        SELECT
            p.id,
            SUM(ip.preco * ip.quantidade) as total
        FROM public.pedidos p
        JOIN public.itens_pedido ip ON p.id = ip.pedido_id
        WHERE p.user_id = p_user_id -- Usando o parâmetro em vez de auth.uid()
          AND p.status = 'pago'
          AND p.closed_at BETWEEN start_date AND end_date
        GROUP BY p.id
    ),
    new_clients_count AS (
        SELECT COUNT(*) as count
        FROM public.clientes c
        WHERE c.user_id = p_user_id AND c.created_at BETWEEN start_date AND end_date -- Usando o parâmetro aqui também
    ),
    aggregated_orders AS (
        SELECT
            COALESCE(SUM(total), 0) as total_revenue,
            COUNT(id) as total_orders
        FROM order_totals
    )
    SELECT
        ao.total_revenue,
        ao.total_orders,
        (CASE
            WHEN ao.total_orders > 0 THEN ao.total_revenue / ao.total_orders
            ELSE 0
        END)::numeric as avg_order_value,
        (SELECT count FROM new_clients_count)::bigint as new_clients
    FROM aggregated_orders ao;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vector_norm(vector)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_norm$function$;

CREATE OR REPLACE FUNCTION public.hnsw_sparsevec_support(internal)
 RETURNS internal
 LANGUAGE c
AS '$libdir/vector', $function$hnsw_sparsevec_support$function$;

CREATE OR REPLACE FUNCTION public.hnswhandler(internal)
 RETURNS index_am_handler
 LANGUAGE c
AS '$libdir/vector', $function$hnswhandler$function$;

CREATE OR REPLACE FUNCTION public.l2_distance(sparsevec, sparsevec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_l2_distance$function$;

CREATE OR REPLACE FUNCTION public.halfvec_negative_inner_product(halfvec, halfvec)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_negative_inner_product$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_recv(internal, oid, integer)
 RETURNS sparsevec
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_recv$function$;

CREATE OR REPLACE FUNCTION public.get_stats_by_date_range(start_date timestamp with time zone, end_date timestamp with time zone)
 RETURNS TABLE(total_revenue numeric, total_orders bigint, avg_order_value numeric, new_clients bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN QUERY
    WITH 
    order_totals AS (
        SELECT
            p.id,
            SUM(ip.preco * ip.quantidade) as total
        FROM public.pedidos p
        JOIN public.itens_pedido ip ON p.id = ip.pedido_id
        WHERE p.user_id = auth.uid()
          AND p.status = 'pago'
          AND p.closed_at BETWEEN start_date AND end_date
        GROUP BY p.id
    ),
    new_clients_count AS (
        SELECT COUNT(*) as count
        FROM public.clientes c
        WHERE c.user_id = auth.uid() AND c.created_at BETWEEN start_date AND end_date
    ),
    aggregated_orders AS (
        SELECT
            COALESCE(SUM(total), 0) as total_revenue,
            COUNT(id) as total_orders
        FROM order_totals
    )
    SELECT
        ao.total_revenue,
        ao.total_orders,
        (CASE 
            WHEN ao.total_orders > 0 THEN ao.total_revenue / ao.total_orders 
            ELSE 0 
        END)::numeric as avg_order_value,
        (SELECT count FROM new_clients_count)::bigint as new_clients
    FROM aggregated_orders ao;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vector_ge(vector, vector)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$vector_ge$function$;

CREATE OR REPLACE FUNCTION public.sparsevec_gt(sparsevec, sparsevec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$sparsevec_gt$function$;

CREATE OR REPLACE FUNCTION public.halfvec_gt(halfvec, halfvec)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_gt$function$;

CREATE OR REPLACE FUNCTION public.halfvec_accum(double precision[], halfvec)
 RETURNS double precision[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/vector', $function$halfvec_accum$function$;

CREATE OR REPLACE FUNCTION public.decrement_product_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_produto_id UUID;
    v_produto_tipo TEXT;
BEGIN
    -- 1. Encontrar o ID e o TIPO do produto com base no nome e user_id
    SELECT id, tipo INTO v_produto_id, v_produto_tipo
    FROM public.produtos
    WHERE nome = NEW.nome_produto AND user_id = NEW.user_id;

    -- 2. Se o produto for encontrado E o tipo for 'venda' (à la carte)
    IF v_produto_id IS NOT NULL AND v_produto_tipo = 'venda' THEN
        -- 3. Decrementar o estoque atual pela quantidade do item
        UPDATE public.produtos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = v_produto_id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Inserir no perfil
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'garcom');
  
  -- Inserir nas configurações do usuário, definindo menu_style como 'sidebar'
  INSERT INTO public.user_settings (id, menu_style)
  VALUES (new.id, 'sidebar');
  
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_api_key()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    new_key TEXT;
BEGIN
    new_key := gen_random_uuid();
    UPDATE public.user_settings
    SET api_key = new_key
    WHERE id = auth.uid();
    RETURN new_key;
END;
$function$;

--
-- TRIGGERS
--

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_itens_pedido_updated_at ON public.itens_pedido;
CREATE TRIGGER update_itens_pedido_updated_at
  BEFORE UPDATE ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_item_pedido_insert_decrement_stock ON public.itens_pedido;
CREATE TRIGGER on_item_pedido_insert_decrement_stock
  AFTER INSERT ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock();

DROP TRIGGER IF EXISTS on_new_occupant_increment_visit ON public.mesa_ocupantes;
CREATE TRIGGER on_new_occupant_increment_visit
  AFTER INSERT ON public.mesa_ocupantes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_visit();

DROP TRIGGER IF EXISTS on_new_occupant ON public.mesa_ocupantes;
CREATE TRIGGER on_new_occupant
  AFTER INSERT ON public.mesa_ocupantes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_occupant_item();

DROP TRIGGER IF EXISTS on_pedido_pago_add_points ON public.pedidos;
CREATE TRIGGER on_pedido_pago_add_points
  AFTER UPDATE OF status ON public.pedidos
  FOR EACH ROW
  WHEN (old.status IS DISTINCT FROM new.status)
  EXECUTE FUNCTION public.handle_pedido_pago_points();