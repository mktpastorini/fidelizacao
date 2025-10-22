import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { showError } from "@/utils/toast";
import { useSettings } from "@/contexts/SettingsContext";

export function AuthLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { settings, isLoading: isLoadingSettings, userRole } = useSettings();

  useEffect(() => {
    const setupSessionAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user) {
        // Verifica se o perfil existe e o cria se não existir
        const { error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single();

        if (error && error.code === 'PGRST116') {
          console.log('Perfil não encontrado para o usuário, criando um.');
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({ id: session.user.id });

          if (insertError) {
            console.error("Falha ao criar o perfil ausente:", insertError);
            showError("Houve um problema ao configurar seu perfil. Tente recarregar a página.");
          }
        }
      }
      setLoading(false);
    };

    setupSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          // Se deslogado, redireciona para login
          navigate("/login");
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    // Lógica de redirecionamento para login
    if (!loading && !session && !isLoadingSettings) {
      
      // Se o usuário não está logado, tentamos carregar a URL do vídeo de fundo
      // A URL do vídeo é agora carregada no Login.tsx a partir do localStorage,
      // que foi preenchido pelo Admin/Superadmin.
      
      // Se o usuário logado for Admin/Superadmin, ele salva a URL no localStorage
      // para que o Login.tsx possa usá-la antes do SettingsContext ser carregado.
      if (userRole && ['superadmin', 'admin'].includes(userRole) && settings?.login_video_url) {
        localStorage.setItem('login_video_url', settings.login_video_url);
      } else if (userRole && ['superadmin', 'admin'].includes(userRole) && !settings?.login_video_url) {
        localStorage.removeItem('login_video_url');
      }
      
      navigate("/login");
    }
  }, [session, loading, navigate, settings, isLoadingSettings, userRole]);

  if (loading || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <Outlet />;
}