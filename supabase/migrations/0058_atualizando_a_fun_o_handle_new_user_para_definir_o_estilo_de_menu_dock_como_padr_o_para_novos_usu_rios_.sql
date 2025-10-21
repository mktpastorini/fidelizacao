CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Inserir no perfil
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  
  -- Inserir nas configurações do usuário, definindo menu_style como 'dock'
  INSERT INTO public.user_settings (id, menu_style)
  VALUES (new.id, 'dock');
  
  RETURN new;
END;
$function$;