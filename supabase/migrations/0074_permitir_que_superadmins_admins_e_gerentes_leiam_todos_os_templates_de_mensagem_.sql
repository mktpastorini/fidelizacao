-- Remove a política antiga que só permitia ler os próprios templates
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar seus próprios templates" ON public.message_templates;

-- Cria uma nova política de SELECT que permite a leitura por todos os usuários autenticados
CREATE POLICY "Allow authenticated users to view all templates" ON public.message_templates
FOR SELECT TO authenticated USING (true);

-- Cria uma política de UPDATE/DELETE/INSERT que restringe a modificação ao user_id do template
CREATE POLICY "Users can manage their own templates" ON public.message_templates
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);