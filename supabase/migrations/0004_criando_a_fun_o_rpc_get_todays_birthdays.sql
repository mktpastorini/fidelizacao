-- Drop the function if it exists
DROP FUNCTION IF EXISTS get_todays_birthdays();

-- Create the function
CREATE OR REPLACE FUNCTION public.get_todays_birthdays()
RETURNS TABLE(nome text, whatsapp text) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;