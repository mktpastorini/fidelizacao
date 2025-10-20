import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginForm } from "@/components/login/LoginForm";
import { VideoBackground } from "@/components/login/VideoBackground";

// Lista de URLs de vídeo padrão.
// Nota: Para usar vídeos locais, eles devem estar na pasta 'public'.
const DEFAULT_VIDEO_URLS = [
  "https://assets.mixkit.co/videos/preview/mixkit-restaurant-with-a-view-of-the-city-at-night-4416-large.mp4",
  // Adicione caminhos relativos para vídeos na sua pasta public aqui, ex:
  // "/videos/restaurant_scene_1.mp4",
  // "/videos/restaurant_scene_2.mp4",
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

  useEffect(() => {
    // Tenta obter a URL(s) salva(s) no localStorage
    const savedUrlOrList = localStorage.getItem('login_video_url');
    
    // Seleciona uma URL aleatória da lista salva ou da lista padrão
    const selectedUrl = selectRandomVideoUrl(savedUrlOrList);
    
    // Se a URL for de localhost, ajusta o caminho para ser relativo (como antes)
    let finalUrl = selectedUrl;
    if (selectedUrl.includes('localhost')) {
        try {
          const urlPath = new URL(selectedUrl).pathname.replace('/public/', '/');
          finalUrl = urlPath;
          console.log("Login Video: Usando caminho local ajustado:", urlPath);
        } catch (e) {
          console.error("Login Video: URL local inválida, usando padrão.");
          finalUrl = selectRandomVideoUrl(null); // Fallback to default list
        }
    }

    setVideoUrl(finalUrl);
    console.log("Login Video: URL selecionada para exibição:", finalUrl);


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