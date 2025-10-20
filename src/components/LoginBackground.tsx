import { useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "./ui/skeleton";

type LoginBackgroundProps = {
  children: ReactNode;
};

// Busca a URL do vídeo de fundo do primeiro usuário (ou de forma genérica)
// Nota: Como o login é anônimo, buscamos a configuração de forma insegura (anon key)
// Assumimos que a URL do vídeo não é sensível.
async function fetchLoginVideoUrl(): Promise<string | null> {
  // Tentativa de buscar a configuração de um usuário (pode falhar se não houver RLS para anon)
  // Como não temos um user_id, vamos buscar a primeira configuração que tiver a URL preenchida.
  const { data, error } = await supabase
    .from('user_settings')
    .select('login_video_url')
    .not('login_video_url', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar URL do vídeo de login:", error);
    return null;
  }
  
  return data?.login_video_url || null;
}

export function LoginBackground({ children }: LoginBackgroundProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLoginVideoUrl().then(url => {
      setVideoUrl(url);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    // Renderiza um fundo simples enquanto carrega
    return <div className="min-h-screen bg-background bg-gradient-radial flex items-center justify-center">{children}</div>;
  }

  if (videoUrl) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute z-0 w-full h-full object-cover opacity-70"
          src={videoUrl}
        />
        <div className="absolute z-10 w-full h-full bg-black/50" />
        <div className="relative z-20 w-full h-full flex items-center justify-center">
          {children}
        </div>
      </div>
    );
  }

  // Fundo padrão se não houver vídeo configurado
  return (
    <div className="min-h-screen bg-background bg-gradient-radial flex items-center justify-center">
      {children}
    </div>
  );
}