import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LoginBackground } from "@/components/LoginBackground";

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

  return (
    <LoginBackground>
      <div className="w-full max-w-md p-8 space-y-8 bg-card/90 backdrop-blur-sm rounded-xl border shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-primary">Fidelize</h1>
          <p className="mt-2 text-muted-foreground">Acesse sua conta</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          theme="dark" // Usando tema escuro para melhor contraste com o fundo
          localization={{
            variables: {
              sign_in: {
                email_label: "Endereço de e-mail",
                password_label: "Senha",
                email_input_placeholder: "Seu endereço de e-mail",
                password_input_placeholder: "Sua senha",
                button_label: "Entrar",
                social_provider_text: "Entrar com {{provider}}",
                link_text: "Já tem uma conta? Entre",
              },
              sign_up: {
                email_label: "Endereço de e-mail",
                password_label: "Senha",
                email_input_placeholder: "Seu endereço de e-mail",
                password_input_placeholder: "Sua senha",
                button_label: "Cadastrar",
                social_provider_text: "Cadastrar com {{provider}}",
                link_text: "Não tem uma conta? Cadastre-se",
                confirmation_text: "Verifique seu e-mail para o link de confirmação"
              },
              forgotten_password: {
                email_label: "Endereço de e-mail",
                email_input_placeholder: "Seu endereço de e-mail",
                button_label: "Enviar instruções de recuperação",
                link_text: "Esqueceu sua senha?",
                confirmation_text: "Verifique seu e-mail para o link de recuperação"
              }
            },
          }}
        />
      </div>
    </LoginBackground>
  );
};

export default Login;