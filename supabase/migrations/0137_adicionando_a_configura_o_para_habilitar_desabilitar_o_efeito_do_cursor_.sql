ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS splash_cursor_enabled BOOLEAN DEFAULT true;