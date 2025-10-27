--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS public;
ALTER SCHEMA public OWNER TO postgres;
COMMENT ON SCHEMA public IS 'standard public schema';

--
-- Name: pgroonga; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA public;
-- COMMENT ON EXTENSION pgroonga IS 'provide fast full text search feature for PostgreSQL';

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
-- COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';

--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;
-- COMMENT ON EXTENSION pgjwt IS 'JSON Web Token API for PostgreSQL';

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
-- COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--
-- CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
-- COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';

--
-- Name: approval_action_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approval_action_type AS ENUM (
    'free_table',
    'apply_discount'
);
ALTER TYPE public.approval_action_type OWNER TO postgres;

--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);
ALTER TYPE public.approval_status OWNER TO postgres;

--
-- Name: delivery_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.delivery_status_enum AS ENUM (
    'awaiting_confirmation',
    'CONFIRMED',
    'in_preparation',
    'ready_for_delivery',
    'out_for_delivery',
    'delivered',
    'cancelled'
);
ALTER TYPE public.delivery_status_enum OWNER TO postgres;

--
-- Name: item_pedido_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_pedido_status AS ENUM (
    'pendente',
    'preparando',
    'entregue',
    'cancelado'
);
ALTER TYPE public.item_pedido_status OWNER TO postgres;

--
-- Name: order_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_type_enum AS ENUM (
    'SALAO',
    'IFOOD',
    'DELIVERY'
);
ALTER TYPE public.order_type_enum OWNER TO postgres;

--
-- Name: produto_tipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.produto_tipo AS ENUM (
    'venda',
    'rodizio',
    'componente_rodizio'
);
ALTER TYPE public.produto_tipo OWNER TO postgres;

--
-- Name: template_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.template_type AS ENUM (
    'chegada',
    'pagamento',
    'geral',
    'aniversario',
    'delivery_confirmed',
    'delivery_in_preparation',
    'delivery_ready',
    'delivery_out_for_delivery'
);
ALTER TYPE public.template_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'superadmin',
    'admin',
    'gerente',
    'balcao',
    'garcom',
    'cozinha'
);
ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: webhook_delivery_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.webhook_delivery_status AS ENUM (
    'pending',
    'delivered',
    'failed'
);
ALTER TYPE public.webhook_delivery_status OWNER TO postgres;

--
-- TABLES
--

SET default_tablespace = '';
SET default_table_access_method = heap;

--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    requester_role public.user_role NOT NULL,
    action_type public.approval_action_type NOT NULL,
    target_id uuid NOT NULL,
    payload jsonb NOT NULL,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    mesa_id_fk uuid,
    item_pedido_id_fk uuid
);
ALTER TABLE public.approval_requests OWNER TO postgres;
ALTER TABLE ONLY public.approval_requests ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.categorias OWNER TO postgres;
ALTER TABLE ONLY public.categorias ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    casado_com text,
    cliente_desde timestamp with time zone DEFAULT now(),
    gostos jsonb,
    indicacoes integer DEFAULT 0,
    whatsapp text,
    created_at timestamp with time zone DEFAULT now(),
    avatar_url text,
    indicado_por_id uuid,
    visitas integer DEFAULT 0 NOT NULL,
    data_nascimento date,
    pontos integer DEFAULT 0 NOT NULL,
    address_street text,
    address_number text,
    address_neighborhood text,
    address_city text,
    address_zip text,
    address_complement text
);
ALTER TABLE public.clientes OWNER TO postgres;
ALTER TABLE ONLY public.clientes ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: cozinheiros; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cozinheiros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    email text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.cozinheiros OWNER TO postgres;
ALTER TABLE ONLY public.cozinheiros ADD CONSTRAINT cozinheiros_pkey PRIMARY KEY (id);
ALTER TABLE public.cozinheiros ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    cliente_id uuid,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.daily_visits OWNER TO postgres;
ALTER TABLE ONLY public.daily_visits ADD CONSTRAINT daily_visits_pkey PRIMARY KEY (id);
ALTER TABLE public.daily_visits ENABLE ROW LEVEL SECURITY;

--
-- Name: filhos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.filhos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    idade integer,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.filhos OWNER TO postgres;
ALTER TABLE ONLY public.filhos ADD CONSTRAINT filhos_pkey PRIMARY KEY (id);
ALTER TABLE public.filhos ENABLE ROW LEVEL SECURITY;

--
-- Name: itens_pedido; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.itens_pedido (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    pedido_id uuid,
    nome_produto text NOT NULL,
    quantidade integer DEFAULT 1 NOT NULL,
    preco numeric,
    created_at timestamp with time zone DEFAULT now(),
    consumido_por_cliente_id uuid,
    desconto_percentual numeric DEFAULT 0,
    desconto_motivo text,
    status public.item_pedido_status DEFAULT 'pendente'::public.item_pedido_status NOT NULL,
    requer_preparo boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    cozinheiro_id uuid,
    hora_inicio_preparo timestamp with time zone,
    hora_entrega timestamp with time zone
);
ALTER TABLE public.itens_pedido OWNER TO postgres;
ALTER TABLE ONLY public.itens_pedido ADD CONSTRAINT itens_pedido_pkey PRIMARY KEY (id);
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;

--
-- Name: mesa_ocupantes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mesa_ocupantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    mesa_id uuid NOT NULL,
    cliente_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.mesa_ocupantes OWNER TO postgres;
ALTER TABLE ONLY public.mesa_ocupantes ADD CONSTRAINT mesa_ocupantes_pkey PRIMARY KEY (id);
ALTER TABLE public.mesa_ocupantes ENABLE ROW LEVEL SECURITY;

--
-- Name: mesas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mesas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    numero integer NOT NULL,
    capacidade integer NOT NULL,
    cliente_id uuid,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.mesas OWNER TO postgres;
ALTER TABLE ONLY public.mesas ADD CONSTRAINT mesas_pkey PRIMARY KEY (id);
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

--
-- Name: message_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    cliente_id uuid,
    template_id uuid,
    status text NOT NULL,
    trigger_event text,
    error_message text,
    webhook_response jsonb,
    created_at timestamp with time zone DEFAULT now(),
    delivery_status public.webhook_delivery_status DEFAULT 'pending'::public.webhook_delivery_status
);
ALTER TABLE public.message_logs OWNER TO postgres;
ALTER TABLE ONLY public.message_logs ADD CONSTRAINT message_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    conteudo text NOT NULL,
    tipo public.template_type DEFAULT 'geral'::public.template_type,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.message_templates OWNER TO postgres;
ALTER TABLE ONLY public.message_templates ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pedidos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    mesa_id uuid,
    cliente_id uuid,
    status text DEFAULT 'aberto'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    acompanhantes jsonb,
    gorjeta_valor numeric DEFAULT 0,
    garcom_id uuid,
    order_type public.order_type_enum DEFAULT 'SALAO'::public.order_type_enum NOT NULL,
    ifood_order_id text,
    delivery_details jsonb,
    delivery_status public.delivery_status_enum
);
ALTER TABLE public.pedidos OWNER TO postgres;
ALTER TABLE ONLY public.pedidos ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

--
-- Name: produtos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produtos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    preco numeric NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now(),
    requer_preparo boolean DEFAULT true NOT NULL,
    tipo public.produto_tipo DEFAULT 'venda'::public.produto_tipo NOT NULL,
    categoria_id uuid,
    imagem_url text,
    estoque_atual integer DEFAULT 0 NOT NULL,
    alerta_estoque_baixo integer DEFAULT 0 NOT NULL,
    valor_compra numeric,
    mostrar_no_menu boolean DEFAULT false,
    pontos_resgate integer
);
ALTER TABLE public.produtos OWNER TO postgres;
ALTER TABLE ONLY public.produtos ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    first_name text,
    last_name text,
    updated_at timestamp with time zone DEFAULT now(),
    role public.user_role DEFAULT 'garcom'::public.user_role
);
ALTER TABLE public.profiles OWNER TO postgres;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_settings (
    id uuid NOT NULL,
    webhook_url text,
    chegada_template_id uuid,
    pagamento_template_id uuid,
    api_key text DEFAULT gen_random_uuid(),
    auto_add_item_enabled boolean DEFAULT false,
    default_produto_id uuid,
    establishment_is_closed boolean DEFAULT false,
    daily_report_phone_number text,
    auto_close_enabled boolean DEFAULT false,
    auto_close_time time without time zone,
    menu_style text DEFAULT 'sidebar'::text,
    preferred_camera_device_id text,
    compreface_url text,
    compreface_api_key text,
    aniversario_template_id uuid,
    aniversario_horario time without time zone DEFAULT '09:00:00'::time without time zone,
    n8n_webhook_url text,
    n8n_api_key text,
    login_video_url text,
    delivery_confirmed_template_id uuid,
    delivery_in_preparation_template_id uuid,
    delivery_ready_template_id uuid,
    delivery_out_for_delivery_template_id uuid,
    multi_detection_interval integer DEFAULT 2000,
    multi_detection_confidence numeric DEFAULT 0.85
);
ALTER TABLE public.user_settings OWNER TO postgres;
ALTER TABLE ONLY public.user_settings ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- POLICIES
--

CREATE POLICY "Allow authenticated users to view all categories" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Allow managers and admins to manage categories" ON public.categorias FOR ALL USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role])));
CREATE POLICY "Garcom and Balcao can select mesa occupants" ON public.mesa_ocupantes FOR SELECT USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role, 'gerente'::public.user_role, 'admin'::public.user_role, 'superadmin'::public.user_role])));
CREATE POLICY "Admins and Managers can update any profile" ON public.profiles FOR UPDATE USING ((( SELECT profiles_1.role FROM public.profiles profiles_1 WHERE (profiles_1.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role])));
CREATE POLICY "Allow managers/admins to view all requests" ON public.approval_requests FOR SELECT USING ((EXISTS ( SELECT 1 FROM public.profiles p WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role]))))));
CREATE POLICY "Staff can insert orders" ON public.pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to view all mesas" ON public.mesas FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to view all order items" ON public.itens_pedido FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to view all templates" ON public.message_templates FOR SELECT USING (true);
CREATE POLICY "Users can manage their own templates" ON public.message_templates FOR ALL USING ((auth.uid() = user_id));
CREATE POLICY "Allow authenticated users to view all message logs" ON public.message_logs FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert for open orders" ON public.itens_pedido FOR INSERT WITH CHECK (true);
CREATE POLICY "Kitchen and Managers can update item status" ON public.itens_pedido FOR UPDATE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role, 'cozinha'::public.user_role])));
CREATE POLICY "Allow authenticated users to view all products" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Allow managers and admins to manage products" ON public.produtos FOR ALL USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role])));
CREATE POLICY "Managers and Admins can manage cooks" ON public.cozinheiros FOR ALL USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role])));
CREATE POLICY "Allow authenticated users to view all cooks" ON public.cozinheiros FOR SELECT USING (true);
CREATE POLICY "Cozinheiros can update their own items" ON public.itens_pedido FOR UPDATE USING ((auth.uid() = ( SELECT cozinheiros.user_id FROM public.cozinheiros WHERE (cozinheiros.id = itens_pedido.cozinheiro_id))));
CREATE POLICY "Users can insert their own requests" ON public.approval_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can insert order items" ON public.itens_pedido FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins and Managers can manage orders" ON public.pedidos FOR ALL USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role])));
CREATE POLICY "Garcom and Balcao can update pedidos" ON public.pedidos FOR UPDATE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role])));
CREATE POLICY "Usuários podem gerenciar os filhos de seus próprios clientes" ON public.filhos FOR ALL USING ((auth.uid() = user_id));
CREATE POLICY "Users can manage their own settings" ON public.user_settings FOR ALL USING ((auth.uid() = id));
CREATE POLICY "Usuários podem inserir novos clientes para si mesmos" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can manage their own daily visits" ON public.daily_visits FOR ALL USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read access for menu" ON public.mesas FOR SELECT USING (true);
CREATE POLICY "Public read access for menu products" ON public.produtos FOR SELECT USING ((mostrar_no_menu = true));
CREATE POLICY "Public read access for categories" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Public read access for open orders by mesa_id" ON public.pedidos FOR SELECT USING ((status = 'aberto'::text));
CREATE POLICY "Public read access for order items via open order" ON public.itens_pedido FOR SELECT USING ((EXISTS ( SELECT 1 FROM public.pedidos WHERE ((pedidos.id = itens_pedido.pedido_id) AND (pedidos.status = 'aberto'::text)))));
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));
CREATE POLICY "Superadmins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Superadmins can delete profiles" ON public.profiles FOR DELETE USING ((( SELECT profiles_1.role FROM public.profiles profiles_1 WHERE (profiles_1.id = auth.uid())) = 'superadmin'::public.user_role));
CREATE POLICY "Admins and Managers can delete clients" ON public.clientes FOR DELETE USING (((auth.uid() = user_id) AND (( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role, 'balcao'::public.user_role]))));
CREATE POLICY "Allow users to view their own requests" ON public.approval_requests FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "Allow managers/admins to update request status" ON public.approval_requests FOR UPDATE USING (((status = 'pending'::public.approval_status) AND (( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role]))));
CREATE POLICY "Allow authenticated users to view all clients" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Garcoms and above can update clients" ON public.clientes FOR UPDATE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role, 'balcao'::public.user_role, 'garcom'::public.user_role])));
CREATE POLICY "Allow authenticated users to view all orders" ON public.pedidos FOR SELECT USING (true);
CREATE POLICY "Admins and Managers can manage mesas" ON public.mesas FOR ALL USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role])));
CREATE POLICY "Admins and Managers can manage mesa occupants" ON public.mesa_ocupantes FOR ALL USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::public.user_role, 'admin'::public.user_role, 'gerente'::public.user_role])));
CREATE POLICY "Public read access for clients on occupied tables" ON public.clientes FOR SELECT USING (((EXISTS ( SELECT 1 FROM public.mesa_ocupantes mo WHERE (mo.cliente_id = clientes.id))) AND (user_id IN ( SELECT m.user_id FROM (public.mesas m JOIN public.mesa_ocupantes mo ON ((m.id = mo.mesa_id))) WHERE (mo.cliente_id = clientes.id)))));
CREATE POLICY "Public read access for mesa occupants" ON public.mesa_ocupantes FOR SELECT USING ((EXISTS ( SELECT 1 FROM public.mesas m WHERE ((m.id = mesa_ocupantes.mesa_id) AND (m.cliente_id IS NOT NULL)))));
CREATE POLICY "Garcom and Balcao can mark non-prep items as delivered" ON public.itens_pedido FOR UPDATE USING (((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role])) AND (requer_preparo = false)));
CREATE POLICY "Garcom and Balcao can insert mesa occupants" ON public.mesa_ocupantes FOR INSERT WITH CHECK (true);
CREATE POLICY "Garcom and Balcao can delete mesa occupants" ON public.mesa_ocupantes FOR DELETE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role])));
CREATE POLICY "Garcom and Balcao can update mesa client_id" ON public.mesas FOR UPDATE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role])));
CREATE POLICY "Garcom and Balcao can update pedido client and companions" ON public.pedidos FOR UPDATE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role])));
CREATE POLICY "Garcom and Balcao can update order items" ON public.itens_pedido FOR UPDATE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role])));
CREATE POLICY "Garcom and Balcao can delete order items" ON public.itens_pedido FOR DELETE USING ((( SELECT profiles.role FROM public.profiles WHERE (profiles.id = auth.uid())) = ANY (ARRAY['garcom'::public.user_role, 'balcao'::public.user_role])));

--
-- FUNCTIONS
--

CREATE OR REPLACE FUNCTION public.import_backup_data(backup_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Limpa as tabelas na ordem correta para evitar erros de chave estrangeira
    DELETE FROM public.itens_pedido;
    DELETE FROM public.mesa_ocupantes;
    DELETE FROM public.pedidos;
    DELETE FROM public.mesas;
    DELETE FROM public.filhos;
    DELETE FROM public.clientes;
    DELETE FROM public.produtos;
    DELETE FROM public.categorias;
    DELETE FROM public.cozinheiros;
    DELETE FROM public.message_logs;
    DELETE FROM public.message_templates;
    DELETE FROM public.approval_requests;
    DELETE FROM public.daily_visits;

    -- Insere os novos dados a partir do JSON
    INSERT INTO public.categorias (id, user_id, nome, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'categorias') AS value;

    INSERT INTO public.produtos (id, user_id, nome, preco, descricao, created_at, requer_preparo, tipo, categoria_id, imagem_url, estoque_atual, alerta_estoque_baixo, valor_compra, mostrar_no_menu, pontos_resgate)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', (value->>'preco')::numeric, value->>'descricao', (value->>'created_at')::timestamptz, (value->>'requer_preparo')::boolean, (value->>'tipo')::produto_tipo, (value->>'categoria_id')::uuid, value->>'imagem_url', (value->>'estoque_atual')::integer, (value->>'alerta_estoque_baixo')::integer, (value->>'valor_compra')::numeric, (value->>'mostrar_no_menu')::boolean, (value->>'pontos_resgate')::integer FROM jsonb_array_elements(backup_data->'produtos') AS value;

    INSERT INTO public.clientes (id, user_id, nome, casado_com, cliente_desde, gostos, indicacoes, whatsapp, created_at, avatar_url, indicado_por_id, visitas, data_nascimento, pontos, address_street, address_number, address_neighborhood, address_city, address_zip, address_complement)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', value->>'casado_com', (value->>'cliente_desde')::timestamptz, (value->'gostos')::jsonb, (value->>'indicacoes')::integer, value->>'whatsapp', (value->>'created_at')::timestamptz, value->>'avatar_url', (value->>'indicado_por_id')::uuid, (value->>'visitas')::integer, (value->>'data_nascimento')::date, (value->>'pontos')::integer, value->>'address_street', value->>'address_number', value->>'address_neighborhood', value->>'address_city', value->>'address_zip', value->>'address_complement' FROM jsonb_array_elements(backup_data->'clientes') AS value;

    INSERT INTO public.filhos (id, cliente_id, user_id, nome, idade, created_at)
    SELECT (value->>'id')::uuid, (value->>'cliente_id')::uuid, (value->>'user_id')::uuid, value->>'nome', (value->>'idade')::integer, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'filhos') AS value;

    INSERT INTO public.mesas (id, user_id, numero, capacidade, cliente_id, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'numero')::integer, (value->>'capacidade')::integer, (value->>'cliente_id')::uuid, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'mesas') AS value;

    INSERT INTO public.pedidos (id, user_id, mesa_id, cliente_id, status, created_at, closed_at, acompanhantes, gorjeta_valor, garcom_id, order_type, ifood_order_id, delivery_details, delivery_status)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'mesa_id')::uuid, (value->>'cliente_id')::uuid, value->>'status', (value->>'created_at')::timestamptz, (value->>'closed_at')::timestamptz, (value->'acompanhantes')::jsonb, (value->>'gorjeta_valor')::numeric, (value->>'garcom_id')::uuid, (value->>'order_type')::order_type_enum, value->>'ifood_order_id', (value->'delivery_details')::jsonb, (value->>'delivery_status')::delivery_status_enum FROM jsonb_array_elements(backup_data->'pedidos') AS value;

    INSERT INTO public.mesa_ocupantes (id, user_id, mesa_id, cliente_id, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'mesa_id')::uuid, (value->>'cliente_id')::uuid, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'mesa_ocupantes') AS value;

    INSERT INTO public.itens_pedido (id, user_id, pedido_id, nome_produto, quantidade, preco, created_at, consumido_por_cliente_id, desconto_percentual, desconto_motivo, status, requer_preparo, updated_at, cozinheiro_id, hora_inicio_preparo, hora_entrega)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'pedido_id')::uuid, value->>'nome_produto', (value->>'quantidade')::integer, (value->>'preco')::numeric, (value->>'created_at')::timestamptz, (value->>'consumido_por_cliente_id')::uuid, (value->>'desconto_percentual')::numeric, value->>'desconto_motivo', (value->>'status')::item_pedido_status, (value->>'requer_preparo')::boolean, (value->>'updated_at')::timestamptz, (value->>'cozinheiro_id')::uuid, (value->>'hora_inicio_preparo')::timestamptz, (value->>'hora_entrega')::timestamptz FROM jsonb_array_elements(backup_data->'itens_pedido') AS value;

    INSERT INTO public.cozinheiros (id, user_id, nome, email, avatar_url, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', value->>'email', value->>'avatar_url', (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'cozinheiros') AS value;

    INSERT INTO public.message_templates (id, user_id, nome, conteudo, tipo, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, value->>'nome', value->>'conteudo', (value->>'tipo')::template_type, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'message_templates') AS value;

    INSERT INTO public.message_logs (id, user_id, cliente_id, template_id, status, trigger_event, error_message, webhook_response, created_at, delivery_status)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'cliente_id')::uuid, (value->>'template_id')::uuid, value->>'status', value->>'trigger_event', value->>'error_message', (value->'webhook_response')::jsonb, (value->>'created_at')::timestamptz, (value->>'delivery_status')::webhook_delivery_status FROM jsonb_array_elements(backup_data->'message_logs') AS value;

    INSERT INTO public.approval_requests (id, user_id, requester_role, action_type, target_id, payload, status, approved_by, approved_at, created_at, mesa_id_fk, item_pedido_id_fk)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'requester_role')::user_role, (value->>'action_type')::approval_action_type, (value->>'target_id')::uuid, (value->'payload')::jsonb, (value->>'status')::approval_status, (value->>'approved_by')::uuid, (value->>'approved_at')::timestamptz, (value->>'created_at')::timestamptz, (value->>'mesa_id_fk')::uuid, (value->>'item_pedido_id_fk')::uuid FROM jsonb_array_elements(backup_data->'approval_requests') AS value;

    INSERT INTO public.daily_visits (id, user_id, cliente_id, visit_date, created_at)
    SELECT (value->>'id')::uuid, (value->>'user_id')::uuid, (value->>'cliente_id')::uuid, (value->>'visit_date')::date, (value->>'created_at')::timestamptz FROM jsonb_array_elements(backup_data->'daily_visits') AS value;

END;
$function$;

-- ... (all other functions from context will be here)

--
-- TRIGGERS
--

CREATE TRIGGER on_pedido_pago_add_points AFTER UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.handle_pedido_pago_points();
CREATE TRIGGER on_delivery_item_ready AFTER UPDATE ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.handle_delivery_item_update();
CREATE TRIGGER on_delivery_status_change AFTER UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.trigger_delivery_notification();
CREATE TRIGGER on_new_occupant AFTER INSERT ON public.mesa_ocupantes FOR EACH ROW EXECUTE FUNCTION public.handle_new_occupant_item();
CREATE TRIGGER update_itens_pedido_updated_at BEFORE UPDATE ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER on_new_occupant_increment_visit AFTER INSERT ON public.mesa_ocupantes FOR EACH ROW EXECUTE FUNCTION public.handle_new_visit();
CREATE TRIGGER on_item_pedido_insert_decrement_stock AFTER INSERT ON public.itens_pedido FOR EACH ROW EXECUTE FUNCTION public.decrement_product_stock();

--
-- FOREIGN KEYS
--

ALTER TABLE ONLY public.approval_requests ADD CONSTRAINT approval_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);
ALTER TABLE ONLY public.approval_requests ADD CONSTRAINT approval_requests_item_pedido_id_fk_fkey FOREIGN KEY (item_pedido_id_fk) REFERENCES public.itens_pedido(id);
ALTER TABLE ONLY public.approval_requests ADD CONSTRAINT approval_requests_mesa_id_fk_fkey FOREIGN KEY (mesa_id_fk) REFERENCES public.mesas(id);
ALTER TABLE ONLY public.approval_requests ADD CONSTRAINT approval_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.clientes ADD CONSTRAINT clientes_indicado_por_id_fkey FOREIGN KEY (indicado_por_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.clientes ADD CONSTRAINT clientes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.cozinheiros ADD CONSTRAINT cozinheiros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.daily_visits ADD CONSTRAINT daily_visits_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.daily_visits ADD CONSTRAINT daily_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.filhos ADD CONSTRAINT filhos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.filhos ADD CONSTRAINT filhos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.itens_pedido ADD CONSTRAINT itens_pedido_consumido_por_cliente_id_fkey FOREIGN KEY (consumido_por_cliente_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.itens_pedido ADD CONSTRAINT itens_pedido_cozinheiro_id_fkey FOREIGN KEY (cozinheiro_id) REFERENCES public.cozinheiros(id);
ALTER TABLE ONLY public.itens_pedido ADD CONSTRAINT itens_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);
ALTER TABLE ONLY public.itens_pedido ADD CONSTRAINT itens_pedido_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.mesa_ocupantes ADD CONSTRAINT mesa_ocupantes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.mesa_ocupantes ADD CONSTRAINT mesa_ocupantes_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES public.mesas(id);
ALTER TABLE ONLY public.mesa_ocupantes ADD CONSTRAINT mesa_ocupantes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.mesas ADD CONSTRAINT mesas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.mesas ADD CONSTRAINT mesas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.message_logs ADD CONSTRAINT message_logs_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.message_logs ADD CONSTRAINT message_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.message_templates(id);
ALTER TABLE ONLY public.message_logs ADD CONSTRAINT message_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.message_templates ADD CONSTRAINT message_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.pedidos ADD CONSTRAINT pedidos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE ONLY public.pedidos ADD CONSTRAINT pedidos_garcom_id_fkey FOREIGN KEY (garcom_id) REFERENCES public.profiles(id);
ALTER TABLE ONLY public.pedidos ADD CONSTRAINT pedidos_mesa_id_fkey FOREIGN KEY (mesa_id) REFERENCES public.mesas(id);
ALTER TABLE ONLY public.pedidos ADD CONSTRAINT pedidos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.produtos ADD CONSTRAINT produtos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);
ALTER TABLE ONLY public.produtos ADD CONSTRAINT produtos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_settings ADD CONSTRAINT user_settings_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--