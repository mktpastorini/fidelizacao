-- Remove a política antiga que só permitia ler os próprios logs
DROP POLICY IF EXISTS "Users can view their own message logs" ON public.message_logs;

-- Cria uma nova política de SELECT que permite a leitura por todos os usuários autenticados
CREATE POLICY "Allow authenticated users to view all message logs" ON public.message_logs
FOR SELECT TO authenticated USING (true);

-- Nota: Não precisamos de políticas de INSERT/UPDATE/DELETE, pois essas operações são feitas apenas via Edge Functions (Service Role Key).