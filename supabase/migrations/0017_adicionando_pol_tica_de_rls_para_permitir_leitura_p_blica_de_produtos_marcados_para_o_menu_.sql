CREATE POLICY "Public read access for menu products" ON public.produtos 
FOR SELECT 
USING (mostrar_no_menu = true);