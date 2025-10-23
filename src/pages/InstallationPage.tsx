import { useState } from 'react';
import { useInstaller } from '@/hooks/useInstaller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Database, Lock } from 'lucide-react';
import { VideoBackground } from '@/components/login/VideoBackground';
import { FullscreenToggle } from '@/components/login/FullscreenToggle';

const InstallationPage = () => {
  const { isInstalling, runInstallation } = useInstaller();
  const [password, setPassword] = useState('');

  const handleInstall = () => {
    if (password.trim()) {
      runInstallation(password);
    } else {
      alert("Por favor, insira a senha de instalação.");
    }
  };
  
  // Usando um vídeo de fundo padrão para a tela de instalação
  const defaultVideoUrl = "/ia.mp4";

  return (
    <div className="relative flex items-center justify-center min-h-screen text-white">
      <VideoBackground videoUrl={defaultVideoUrl} />
      <FullscreenToggle />
      
      <Card className="w-full max-w-md z-20 p-6 backdrop-blur-sm bg-black/50 border border-white/10">
        <CardHeader className="text-center">
          <Database className="w-12 h-12 mx-auto mb-2 text-primary" />
          <CardTitle className="text-3xl text-white">Configuração Inicial</Cardbase</CardTitle>
          <CardDescription className="text-white/70">
            O banco de dados Supabase não está configurado. Insira a senha de instalação para aplicar o esquema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
            <Input
              type="password"
              placeholder="Senha de Instalação"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInstall()}
              className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-primary/50 transition-colors"
              disabled={isInstalling}
            />
          </div>
          <Button
            onClick={handleInstall}
            disabled={isInstalling || !password.trim()}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg"
          >
            {isInstalling ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aplicando Esquema...</>
            ) : (
              "Iniciar Instalação"
            )}
          </Button>
          <p className="text-xs text-center text-white/50 mt-4">
            A senha de instalação deve ser configurada no ambiente do Edge Function.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallationPage;