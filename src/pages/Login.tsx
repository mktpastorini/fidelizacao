import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LoginForm } from "@/components/login/LoginForm";
import { VideoBackground } from "@/components/login/VideoBackground";

// URL padrão do vídeo de fundo. O usuário pode configurar um URL personalizado nas configurações.
const DEFAULT_VIDEO_URL = "https://hgqcmpuihoflkkobtyfa.supabase.co/storage/v1/object/public/assets/login_video.mp4";

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
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

  // Nota: O URL do vídeo configurado pelo usuário é buscado e usado no componente AuthLayout/Layout, 
  // mas como esta é a página de login (não autenticada), usamos o padrão.
  // O usuário pode configurar o vídeo padrão nas configurações.

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      <VideoBackground videoUrl={DEFAULT_VIDEO_URL} />
      <LoginForm />
    </div>
  );
};

export default Login;