-- Create categories table
CREATE TABLE public.categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Users can manage their own categories" ON public.categorias
FOR ALL TO authenticated USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add columns to produtos table
ALTER TABLE public.produtos
ADD COLUMN categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
ADD COLUMN imagem_url TEXT;