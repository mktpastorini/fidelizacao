UPDATE public.profiles
SET role = 'superadmin'
WHERE id = auth.uid();