import { useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

type LoginBackgroundProps = {
  children: ReactNode;
};

async function fetchLoginVideoUrl(): Promise<string | null> {
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
    return <div className="min-h-screen bg-background bg-gradient-radial flex items-center justify-center">{children}</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background bg-gradient-radial">
      <div className={cn(
        "w-full max-w-5xl h-[90vh] max-h-[700px] rounded-2xl shadow-2xl overflow-hidden",
        "grid grid-cols-1 lg:grid-cols-5"
      )}>
        {/* Coluna do Vídeo (2/5) */}
        <div className="relative hidden lg:block lg:col-span-2 bg-gray-900">
          {videoUrl ? (
            <>
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute z-0 w-full h-full object-cover opacity-70"
                src={videoUrl}
              />
              <div className="absolute z-10 w-full h-full bg-black/50" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <p className="text-white/50 text-center p-4">Vídeo de fundo não configurado.</p>
            </div>
          )}
        </div>

        {/* Coluna do Formulário (3/5) */}
        <div className="lg:col-span-3 bg-card flex items-center justify-center p-8 relative z-20">
          {children}
        </div>
      </div>
    </div>
  );
}