import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { LoginForm } from "@/components/login/LoginForm";
import { VideoBackground } from "@/components/login/VideoBackground";
import { FullscreenToggle } from "@/components/login/FullscreenToggle";

// Lista de URLs de vídeo padrão, como era antes.
const VIDEO_URLS = [
  "/ia.mp4",
  "/ia4.mp4",
  "/ia2.mp4",
  "/ia3.mp4",
];

const Login = () => {
  const navigate = useNavigate();
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // Seleciona um índice aleatório para começar
  useEffect(() => {
    setCurrentVideoIndex(Math.floor(Math.random() * VIDEO_URLS.length));
  }, []);

  const loadNextVideo = useCallback(() => {
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % VIDEO_URLS.length);
  }, []);

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

  const videoUrl = VIDEO_URLS[currentVideoIndex];

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      {videoUrl && <VideoBackground videoUrl={videoUrl} onVideoEnded={loadNextVideo} />}
      <FullscreenToggle />
      <LoginForm />
    </div>
  );
};

export default Login;