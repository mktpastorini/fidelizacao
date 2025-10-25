-- Adiciona novos valores ao tipo enum de template
ALTER TYPE public.template_type ADD VALUE IF NOT EXISTS 'delivery_confirmed';
ALTER TYPE public.template_type ADD VALUE IF NOT EXISTS 'delivery_in_preparation';
ALTER TYPE public.template_type ADD VALUE IF NOT EXISTS 'delivery_ready';
ALTER TYPE public.template_type ADD VALUE IF NOT EXISTS 'delivery_out_for_delivery';

-- Adiciona novas colunas à tabela de configurações do usuário
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS delivery_confirmed_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS delivery_in_preparation_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS delivery_ready_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS delivery_out_for_delivery_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL;