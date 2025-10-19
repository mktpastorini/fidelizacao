-- Adiciona coluna mostrar_no_menu para controle de exibição no menu público
ALTER TABLE public.produtos ADD COLUMN mostrar_no_menu boolean NOT NULL DEFAULT false;