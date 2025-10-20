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
    const savedUrl = localStorage.getItem('login_video_url');
    if (savedUrl) {
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

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      <VideoBackground videoUrl={videoUrl} />
      <LoginForm />
    </div>
  );
};

export default Login;