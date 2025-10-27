import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function Saida() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login');
    }, 3000); // Redireciona após 3 segundos

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-muted">
      {/* Esta página foi projetada para uma experiência visual focada, como uma imagem ou vídeo de fundo.
          O processo de logout é executado em segundo plano e redireciona para a página de login. */}
    </div>
  );
}