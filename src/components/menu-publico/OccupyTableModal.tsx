import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Cliente } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, UserPlus, Loader2, Camera, RefreshCw, User } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useFaceRecognition, FaceRecognitionResult } from '@/hooks/useFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { QuickRegistrationStepper } from './QuickRegistrationStepper';
import { supabase } from '@/integrations/supabase/client';

type OccupyTableModalProps = {
  isOpen: boolean;
  mesaId: string;
  mesaUserId: string;
  onTableOccupied: () => void;
};

export function OccupyTableModal({ isOpen, mesaId, mesaUserId, onTableOccupied }: OccupyTableModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isScanning, error: recognitionError, recognize } = useFaceRecognition();
  
  const [step, setStep] = useState<'capture' | 'identifying' | 'match' | 'no_match' | 'quick_register'>('capture');
  const [match, setMatch] = useState<Cliente | null>(null);
  const [isSubmittingNewClient, setIsSubmittingNewClient] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const videoConstraints = {
    width: 400,
    height: 400,
    facingMode: "user",
    deviceId: settings?.preferred_camera_device_id || undefined,
  };

  const resetState = useCallback(() => {
    setMatch(null);
    setStep('capture');
    setMediaError(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleMediaError = useCallback((err: any) => {
    console.error("Erro ao acessar a câmera:", err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setMediaError("Acesso à câmera negado. Por favor, permita o acesso nas configurações do seu navegador.");
    } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setMediaError("Acesso à câmera bloqueado. O menu deve ser acessado via HTTPS.");
    } else {
      setMediaError(`Erro de mídia: ${err.message}`);
    }
  }, []);

  const performRecognition = useCallback(async (imageSrc: string) => {
    if (!isReady || !recognize || step !== 'capture') return;

    setStep('identifying');
    const result = await recognize(imageSrc); 
    
    if (result?.status === 'MATCH_FOUND' && result.match) {
      setMatch(result.match);
      setStep('match');
    } else {
      setMatch(null);
      setStep('no_match');
      if (result?.message) showError(result.message);
    }
  }, [isReady, recognize, step]);

  const handleCapture = useCallback(() => {
    if (mediaError || !webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      performRecognition(imageSrc);
    }
  }, [performRecognition, mediaError]);

  const handleConfirmMatch = async () => {
    if (!match) return;
    try {
      const { error } = await supabase.functions.invoke('occupy-table-public', {
        body: { mesa_id: mesaId, cliente_id: match.id }
      });
      if (error) throw error;
      showSuccess(`Bem-vindo(a), ${match.nome}! A mesa foi aberta em seu nome.`);
      onTableOccupied();
    } catch (error: any) {
      showError(`Erro ao ocupar a mesa: ${error.message}`);
    }
  };

  const handleQuickRegister = async (values: { nome: string; whatsapp?: string; avatar_url: string; }) => {
    if (!values.avatar_url) {
      showError("A foto é obrigatória para o cadastro.");
      return;
    }
    setIsSubmittingNewClient(true);

    try {
      const { error: rpcError, data: newClientId } = await supabase.rpc('create_client_with_referral', {
        p_user_id: mesaUserId, p_nome: values.nome, p_casado_com: null,
        p_whatsapp: values.whatsapp, p_gostos: null, p_avatar_url: values.avatar_url,
        p_indicado_por_id: null,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (!newClientId) throw new Error("Falha ao obter o ID do novo cliente.");

      const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
        body: { subject: newClientId, image_urls: [values.avatar_url] }
      });
      if (faceError) throw faceError;

      const { error: occupyError } = await supabase.functions.invoke('occupy-table-public', {
        body: { mesa_id: mesaId, cliente_id: newClientId }
      });
      if (occupyError) throw occupyError;

      showSuccess(`Bem-vindo(a), ${values.nome}! A mesa foi aberta em seu nome.`);
      onTableOccupied();

    } catch (error: any) {
      showError(`Erro no cadastro: ${error.message}`);
    } finally {
      setIsSubmittingNewClient(false);
    }
  };

  const renderContent = () => {
    const displayError = recognitionError || mediaError;

    if (displayError) {
      return (
        <div className="text-center py-4 space-y-4">
          <p className="text-lg font-bold text-destructive">Erro de Câmera</p>
          <p className="text-sm text-muted-foreground">{displayError}</p>
          <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
        </div>
      );
    }

    switch (step) {
      case 'capture':
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-primary/50 flex items-center justify-center bg-black shadow-xl">
              <Webcam 
                audio={false} 
                ref={webcamRef} 
                screenshotFormat="image/jpeg" 
                videoConstraints={videoConstraints} 
                className="w-full h-full object-cover" 
                mirrored={true}
                onUserMediaError={handleMediaError}
              />
            </div>
            <Button onClick={handleCapture} disabled={isScanning}><Camera className="w-4 h-4 mr-2" />Identificar</Button>
          </div>
        );
      case 'identifying':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-lg text-primary">Analisando...</p>
          </div>
        );
      case 'match':
        return (
          <div className="text-center py-4 space-y-4">
            <Avatar className="w-20 h-20 mx-auto ring-2 ring-primary ring-offset-2 ring-offset-card">
              <AvatarImage src={match?.avatar_url || undefined} />
              <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
            </Avatar>
            <p className="text-lg font-bold text-primary">Bem-vindo(a) de volta, {match?.nome}!</p>
            <p className="text-sm text-muted-foreground">Deseja abrir a comanda em seu nome?</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Não sou eu</Button>
              <Button onClick={handleConfirmMatch} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Check className="w-4 h-4 mr-2" />Sim, Ocupar Mesa</Button>
            </div>
          </div>
        );
      case 'no_match':
        return (
          <div className="text-center py-4 space-y-4">
            <p className="text-lg font-bold text-destructive">Não te reconhecemos.</p>
            <p className="text-sm text-muted-foreground">Deseja fazer um cadastro rápido para abrir a comanda?</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
              <Button onClick={() => setStep('quick_register')} className="bg-primary hover:bg-primary/90 text-primary-foreground"><UserPlus className="w-4 h-4 mr-2" />Cadastrar Rápido</Button>
            </div>
          </div>
        );
      case 'quick_register':
        return (
          <QuickRegistrationStepper 
            onSubmit={handleQuickRegister} 
            isSubmitting={isSubmittingNewClient} 
          />
        );
      default:
        return null;
    }
  };

  const dialogTitle = useMemo(() => {
    if (step === 'quick_register') return "Cadastro Rápido";
    if (step === 'match') return "Cliente Identificado";
    return "Identifique-se para Ocupar a Mesa";
  }, [step]);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">{dialogTitle}</DialogTitle>
          <DialogDescription>
            Para começar a pedir, precisamos saber quem você é.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}