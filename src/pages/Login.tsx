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
      // Ajuste para URLs locais que podem ter sido salvas com o prefixo /public/
      if (savedUrl.includes('localhost') && savedUrl.includes('/public/')) {
        savedUrl = savedUrl.replace('/public/', '/');
      }
      setVideoUrl(savedUrl);
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

  // Verifica se a URL é válida antes de renderizar o componente de vídeo
  const isVideoUrlValid = videoUrl && videoUrl.startsWith('http');

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      {isVideoUrlValid && <VideoBackground videoUrl={videoUrl} />}
      <LoginForm />
    </div>
  );
};

export default Login;