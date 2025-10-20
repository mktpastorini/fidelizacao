import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/login/LoginForm";
import { VideoBackground } from "@/components/login/VideoBackground";

// URL padrão do vídeo de fundo.
const DEFAULT_VIDEO_URL = "https://hgqcmpuihoflkkobtyfa.supabase.co/storage/v1/object/public/assets/login_video.mp4";

const Login = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO_URL);

  useEffect(() => {
    // Tenta obter a URL salva no localStorage
    let savedUrl = localStorage.getItem('login_video_url');
    
    if (savedUrl) {
      // Se for uma URL de localhost, extrai apenas o caminho relativo /ia.mp4
      if (savedUrl.includes('localhost')) {
        try {
          // Usa URL API para extrair o pathname e remove o prefixo /public/ se existir
          const urlPath = new URL(savedUrl).pathname.replace('/public/', '/');
          setVideoUrl(urlPath);
        } catch (e) {
          // Se a URL for inválida, volta para a URL padrão
          setVideoUrl(DEFAULT_VIDEO_URL);
        }
      } else if (savedUrl.startsWith('http')) {
        setVideoUrl(savedUrl);
      } else {
        setVideoUrl(DEFAULT_VIDEO_URL);
      }
    } else {
      setVideoUrl(DEFAULT_VIDEO_URL);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        navigate("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Se a URL for um caminho relativo (ex: /ia.mp4), ela não começa com 'http', mas é válida.
  const isVideoUrlValid = !!videoUrl;

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      {isVideoUrlValid && <VideoBackground videoUrl={videoUrl} />}
      <LoginForm />
    </div>
  );
};

export default Login;