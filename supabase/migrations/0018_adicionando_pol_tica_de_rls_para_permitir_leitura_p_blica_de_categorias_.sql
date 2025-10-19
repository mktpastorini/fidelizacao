CREATE POLICY "Public read access for categories" ON public.categorias 
FOR SELECT 
USING (true);