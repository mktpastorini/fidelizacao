-- Drop the function if it exists
DROP FUNCTION IF EXISTS get_todays_birthdays_by_user(uuid);

-- Create the new function that filters by user_id
CREATE OR REPLACE FUNCTION public.get_todays_birthdays_by_user(p_user_id uuid)
RETURNS TABLE(id uuid, nome text, whatsapp text, data_nascimento date, gostos jsonb) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
        AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM NOW());
END;
$function$;