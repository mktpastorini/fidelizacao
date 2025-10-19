CREATE POLICY "Public read access for menu" ON public.mesas 
FOR SELECT 
USING (true);