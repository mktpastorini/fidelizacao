-- Adiciona a coluna de data de nascimento na tabela de clientes
ALTER TABLE public.clientes
ADD COLUMN data_nascimento DATE;

-- Adiciona as configurações de aniversário na tabela de configurações do usuário
ALTER TABLE public.user_settings
ADD COLUMN aniversario_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL;

ALTER TABLE public.user_settings
ADD COLUMN aniversario_horario TIME WITHOUT TIME ZONE DEFAULT '09:00:00';

-- Adiciona o tipo 'aniversario' aos tipos de template existentes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'aniversario' AND enumtypid = 'template_type'::regtype) THEN
        ALTER TYPE public.template_type ADD VALUE 'aniversario';
    END IF;
END$$;

-- Cria uma função para buscar os aniversariantes do dia para o usuário logado
CREATE OR REPLACE FUNCTION public.get_todays_birthdays()
RETURNS TABLE(nome text, whatsapp text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
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
        AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM NOW());
END;
$$;