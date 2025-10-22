-- Remove a política existente que permite a leitura de todas as mesas (se existir)
DROP POLICY IF EXISTS "Allow authenticated users to view all mesas" ON public.mesas;

-- Cria uma nova política para garantir que qualquer usuário autenticado possa ler qualquer mesa
CREATE POLICY "Allow authenticated users to view all mesas" ON public.mesas 
FOR SELECT TO authenticated USING (true);