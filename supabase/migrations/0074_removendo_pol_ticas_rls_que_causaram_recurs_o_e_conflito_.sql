-- Removendo a política de SELECT em profiles que causou recursão
DROP POLICY IF EXISTS "Admins and Managers can select all profiles" ON public.profiles;

-- Removendo a política de SELECT em mesas que causou conflito
DROP POLICY IF EXISTS "Admins and Managers can select all mesas" ON public.mesas;

-- Removendo a política de SELECT em itens_pedido que causou conflito
DROP POLICY IF EXISTS "Admins and Managers can select all itens_pedido" ON public.itens_pedido;