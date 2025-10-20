import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/login/LoginForm";
import { VideoBackground } from "@/components/login/VideoBackground";

// Lista de URLs de vídeo padrão.
// Se você adicionar vídeos à sua pasta 'public' (ex: public/videos/fundo1.mp4),
// adicione o caminho relativo aqui (ex: "/videos/fundo1.mp4").
const DEFAULT_VIDEO_URLS = [
  "http://localhost:32100/ia.mp4",]
  // Adicione seus vídeos locais aqui:
  // "/videos/fundo1.mp4",
  // "/videos/fundo2.mp4",
];

// Função para selecionar uma URL de vídeo aleatória de uma lista (ou usar a única se for string)
function selectRandomVideoUrl(urlOrList: string | null | undefined): string {
  let urls: string[] = [];
  
  if (urlOrList) {
    urls = urlOrList.split(',').map(url => url.trim()).filter(url => url.length > 0);
  }
  
  // Se o usuário não configurou nada, usamos a lista padrão
  if (urls.length === 0) {
    urls = DEFAULT_VIDEO_URLS;
  }

  const randomIndex = Math.floor(Math.random() * urls.length);
  return urls[randomIndex];
}

const Login = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    // Tenta obter a URL(s) salva(s) no localStorage
    const savedUrlOrList = localStorage.getItem('login_video_url');
    
    // Seleciona uma URL aleatória da lista salva ou da lista padrão
    const selectedUrl = selectRandomVideoUrl(savedUrlOrList);
    
    setVideoUrl(selectedUrl);
    console.log("Login Video: URL selecionada para exibição:", selectedUrl);


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

  const isVideoUrlValid = !!videoUrl;

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      {isVideoUrlValid && <VideoBackground videoUrl={videoUrl} />}
      <LoginForm />
    </div>
  );
};

export default Login;