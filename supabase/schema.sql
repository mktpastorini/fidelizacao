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
  CREATE TYPE public.item_pedido_status AS ENUM ('pendente', 'preparando', 'entregue');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Tabela: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Tabela: public.user_settings
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  webhook_url TEXT,
  chegada_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  pagamento_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  api_key TEXT DEFAULT gen_random_uuid(),
  auto_add_item_enabled BOOLEAN DEFAULT FALSE,
  default_produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  establishment_is_closed BOOLEAN DEFAULT FALSE,
  daily_report_phone_number TEXT,
  auto_close_enabled BOOLEAN DEFAULT FALSE,
  auto_close_time TIME WITHOUT TIME ZONE,
  menu_style TEXT DEFAULT 'sidebar'::TEXT,
  preferred_camera_device_id TEXT,
  compreface_url TEXT,
  compreface_api_key TEXT,
  aniversario_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  aniversario_horario TIME WITHOUT TIME ZONE DEFAULT '09:00:00'::TIME WITHOUT TIME ZONE,
  n8n_webhook_url TEXT,
  n8n_api_key TEXT,
  login_video_url TEXT
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Tabela: public.clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  casado_com TEXT,
  cliente_desde TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gostos JSONB,
  indicacoes INTEGER DEFAULT 0,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  avatar_url TEXT,
  indicado_por_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  visitas INTEGER DEFAULT 0 NOT NULL,
  data_nascimento DATE
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver seus próprios clientes" ON public.clientes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem inserir novos clientes para si mesmos" ON public.clientes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem atualizar seus próprios clientes" ON public.clientes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem deletar seus próprios clientes" ON public.clientes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tabela: public.filhos
CREATE TABLE IF NOT EXISTS public.filhos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  idade INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.filhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem gerenciar os filhos de seus próprios clientes" ON public.filhos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabela: public.categorias
CREATE TABLE IF NOT EXISTS public.categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own categories" ON public.categorias FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public read access for categories" ON public.categorias FOR SELECT USING (true);

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
  mostrar_no_menu BOOLEAN DEFAULT FALSE
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem gerenciar seus próprios produtos" ON public.produtos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public read access for menu products" ON public.produtos FOR SELECT USING (mostrar_no_menu = true);

-- Tabela: public.mesas
CREATE TABLE IF NOT EXISTS public.mesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  capacidade INTEGER NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados podem gerenciar suas próprias mesas" ON public.mesas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public read access for menu" ON public.mesas FOR SELECT USING (true);

-- Tabela: public.mesa_ocupantes
CREATE TABLE IF NOT EXISTS public.mesa_ocupantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mesa_id UUID NOT NULL REFERENCES public.mesas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (mesa_id, cliente_id, user_id) -- Garante que um cliente só pode ocupar uma mesa uma vez por usuário
);
ALTER TABLE public.mesa_ocupantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem gerenciar os ocupantes de suas mesas" ON public.mesa_ocupantes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tabela: public.pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.mesas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'aberto'::TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  acompanhantes JSONB
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own orders" ON public.pedidos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public read access for open orders by mesa_id" ON public.pedidos FOR SELECT USING (status = 'aberto'::text);

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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own order items" ON public.itens_pedido FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public read access for order items via open order" ON public.itens_pedido FOR SELECT USING (EXISTS ( SELECT 1 FROM public.pedidos WHERE ((public.pedidos.id = itens_pedido.pedido_id) AND (public.pedidos.status = 'aberto'::text))));

-- Tabela: public.message_templates
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo public.template_type DEFAULT 'geral'::public.template_type,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own message templates" ON public.message_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own message logs" ON public.message_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own message logs" ON public.message_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own message logs" ON public.message_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Tabela: public.daily_visits
CREATE TABLE IF NOT EXISTS public.daily_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  visit_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, cliente_id, visit_date)
);
ALTER TABLE public.daily_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own daily visits" ON public.daily_visits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Funções RPC:
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.finalizar_pagamento_parcial(p_pedido_id uuid, p_cliente_id_pagando uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_mesa_id uuid;
    new_pedido_id uuid;
    remaining_items_count integer;
    v_acompanhantes_originais jsonb; -- Alterado para buscar do pedido original
BEGIN
    -- 1. Obter informações do pedido original, incluindo a lista de acompanhantes original
    SELECT user_id, mesa_id, acompanhantes INTO v_user_id, v_mesa_id, v_acompanhantes_originais
    FROM public.pedidos
    WHERE id = p_pedido_id AND user_id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Pedido não encontrado ou não pertence ao usuário.';
    END IF;

    -- 2. Criar um novo pedido "recibo" para o cliente que está pagando, usando a lista original
    INSERT INTO public.pedidos (user_id, cliente_id, status, closed_at, mesa_id, acompanhantes)
    VALUES (v_user_id, p_cliente_id_pagando, 'pago', now(), v_mesa_id, v_acompanhantes_originais)
    RETURNING id INTO new_pedido_id;

    -- 3. Mover os itens do cliente para o novo pedido "recibo"
    UPDATE public.itens_pedido
    SET pedido_id = new_pedido_id
    WHERE pedido_id = p_pedido_id AND consumido_por_cliente_id = p_cliente_id_pagando;

    -- 4. Remover o cliente da lista de ocupantes da mesa (lógica de ocupação atual)
    DELETE FROM public.mesa_ocupantes
    WHERE mesa_id = v_mesa_id AND cliente_id = p_cliente_id_pagando;

    -- 5. Verificar se o pedido original ainda tem itens
    SELECT COUNT(*) INTO remaining_items_count
    FROM public.itens_pedido
    WHERE pedido_id = p_pedido_id;

    -- 6. Se o pedido original estiver vazio, fechar a mesa e salvar os acompanhantes originais
    IF remaining_items_count = 0 THEN
        UPDATE public.pedidos
        SET status = 'pago', closed_at = now(), acompanhantes = v_acompanhantes_originais
        WHERE id = p_pedido_id;

        UPDATE public.mesas
        SET cliente_id = NULL
        WHERE id = v_mesa_id;
    END IF;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.decrement_product_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_produto_id UUID;
BEGIN
    -- 1. Encontrar o ID do produto com base no nome e user_id
    SELECT id INTO v_produto_id
    FROM public.produtos
    WHERE nome = NEW.nome_produto AND user_id = NEW.user_id;

    -- 2. Se o produto for encontrado e não for um item de rodízio (que não afeta o estoque principal)
    IF v_produto_id IS NOT NULL THEN
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
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  
  -- Inserir nas configurações do usuário
  INSERT INTO public.user_settings (id)
  VALUES (new.id);
  
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
        SELECT nome, preco INTO v_produto FROM public.produtos WHERE id = v_settings.default_produto_id;

        -- Encontra o pedido aberto para a mesa
        SELECT id INTO v_pedido_id FROM public.pedidos WHERE mesa_id = NEW.mesa_id AND status = 'aberto';

        -- Se houver um pedido aberto e um produto válido, insere o item
        IF v_pedido_id IS NOT NULL AND v_produto IS NOT NULL THEN
            INSERT INTO public.itens_pedido (pedido_id, user_id, nome_produto, preco, quantidade, consumido_por_cliente_id)
            VALUES (v_pedido_id, v_user_id, v_produto.nome, v_produto.preco, 1, NEW.cliente_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

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

-- Triggers:
CREATE TRIGGER on_new_occupant AFTER INSERT ON public.mesa_ocupantes FOR EACH ROW EXECUTE FUNCTION public.handle_new_occupant_item();
CREATE TRIGGER on_new_occupant_increment_visit AFTER INSERT ON public.mesa_ocupantes FOR EACH ROW EXECUTE FUNCTION public.handle_new_visit();
CREATE TRIGGER on_item_pedido_insert_decrement_stock AFTER INSERT ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock();
CREATE TRIGGER update_itens_pedido_updated_at BEFORE UPDATE ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();