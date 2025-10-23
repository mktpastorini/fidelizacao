import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { LoginForm } from "@/components/login/LoginForm";
import { VideoBackground } from "@/components/login/VideoBackground";
import { FullscreenToggle } from "@/components/login/FullscreenToggle";

// Lista de URLs de vídeo padrão.
const DEFAULT_VIDEO_URLS = [
  "https://assets.mixkit.co/videos/preview/mixkit-restaurant-with-a-view-of-the-city-at-night-4416-large.mp4",
  
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
  
  if (urls.length === 0) {
    urls = DEFAULT_VIDEO_URLS;
  }

  const randomIndex = Math.floor(Math.random() * urls.length);
  return urls[randomIndex];
}

const Login = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');

  const loadNextVideo = useCallback(() => {
    // Tenta obter a URL(s) salva(s) no localStorage
    const savedUrlOrList = localStorage.getItem('login_video_url');
    
    // Seleciona uma URL aleatória da lista salva ou da lista padrão
    const selectedUrl = selectRandomVideoUrl(savedUrlOrList);
    
    setVideoUrl(selectedUrl);
    console.log("Login Video: URL selecionada para exibição:", selectedUrl);
  }, []);

  useEffect(() => {
    loadNextVideo(); // Carrega o primeiro vídeo na montagem

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
  }, [navigate, loadNextVideo]);

  const isVideoUrlValid = !!videoUrl;

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      {isVideoUrlValid && <VideoBackground videoUrl={videoUrl} onVideoEnded={loadNextVideo} />}
      <FullscreenToggle />
      <LoginForm />
    </div>
  );
};

export default Login;