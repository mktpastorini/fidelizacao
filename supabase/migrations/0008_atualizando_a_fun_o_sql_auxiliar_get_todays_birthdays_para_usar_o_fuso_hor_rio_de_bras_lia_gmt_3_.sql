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