CREATE OR REPLACE FUNCTION public.execute_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
END;
$$;

-- Grant usage to the service role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION public.execute_sql(TEXT) TO service_role;