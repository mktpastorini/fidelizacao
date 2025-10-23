-- Remove a política anterior que pode estar causando conflito ou não está correta
DROP POLICY IF EXISTS "Admins, Managers, and Kitchen can update order items" ON public.itens_pedido;

-- Cria uma nova política para gerenciar o status de preparo
CREATE POLICY "Kitchen and Managers can update item status" ON public.itens_pedido
FOR UPDATE TO authenticated
USING (
  (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) 
  = ANY (ARRAY['superadmin'::user_role, 'admin'::user_role, 'gerente'::user_role, 'cozinha'::user_role])
);