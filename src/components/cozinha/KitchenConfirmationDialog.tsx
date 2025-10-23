import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Camera, RefreshCw, User } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useSettings } from '@/contexts/SettingsContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useUserFaceRecognition } from '@/hooks/useUserFaceRecognition'; // NOVO HOOK

type KitchenConfirmationDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirmed: (userId: string) => void;
  isSubmitting: boolean;
  targetUserId: string; // ID do usuário logado que deve ser confirmado
};

export function KitchenConfirmationDialog({ isOpen, onOpenChange, onConfirmed, isSubmitting, targetUserId }: KitchenConfirmationDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isScanning, error: recognitionError, recognize } = useUserFaceRecognition(); // USANDO NOVO HOOK
  
  const [step, setStep] = useState<'capture' | 'identifying' | 'match' | 'no_match'>('capture');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<{ user: { id: string, nome: string }, distance: number } | null>(null);

  const resetState = useCallback(() => {
    setMatchResult(null);
    setSnapshot(null);
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
    setMediaError("Não foi possível acessar a câmera. Verifique as permissões.");
  }, []);

  const performRecognition = useCallback(async (imageSrc: string) => {
    if (!isReady || !recognize) return;

    setStep('identifying');
    const result = await recognize(imageSrc);
    
    if (result) {
      setMatchResult(result);
      setStep('match');
    } else {
      setMatchResult(null);
      setStep('no_match');
    }
  }, [isReady, recognize]);

  const handleCapture = useCallback(() => {
    if (mediaError) {
      showError(mediaError);
      return;
    }
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setSnapshot(imageSrc);
        performRecognition(imageSrc);
      } else {
        showError("Não foi possível capturar a imagem. Tente novamente.");
      }
    }
  }, [performRecognition, mediaError]);

  const handleConfirm = () => {
    // Verifica se o ID reconhecido é o mesmo do usuário logado
    if (matchResult?.user.id === targetUserId) {
      onConfirmed(targetUserId);
      onOpenChange(false);
    } else {
      showError("Identificação falhou. Você não é o usuário logado.");
      resetState();
    }
  };

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: settings?.preferred_camera_device_id ? { exact: settings.preferred_camera_device_id } : undefined,
  };

  const renderContent = () => {
    const displayError = recognitionError || mediaError;

    if (displayError) {
      return (
        <div className="text-center py-4 space-y-4">
          <p className="text-lg font-bold text-destructive">Erro de Câmera/Reconhecimento</p>
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
            <Button onClick={handleCapture} disabled={!isReady || isSubmitting} className="w-full max-w-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              <Camera className="w-4 h-4 mr-2" /> Capturar Rosto
            </Button>
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
        const isMatch = matchResult?.user.id === targetUserId;
        const matchName = matchResult?.user.nome || "Desconhecido";
        
        return (
          <div className="text-center py-4 space-y-4">
            <Avatar className="w-20 h-20 mx-auto ring-2 ring-primary ring-offset-2 ring-offset-card">
              <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
            </Avatar>
            {isMatch ? (
                <>
                    <p className="text-lg font-bold text-green-600">Identidade Confirmada: {matchName}</p>
                    <p className="text-sm text-muted-foreground">Confiança: {((1 - matchResult!.distance) * 100).toFixed(2)}%</p>
                </>
            ) : (
                <p className="text-lg font-bold text-destructive">Identidade Incorreta: {matchName}</p>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
              {isMatch && (
                <Button onClick={handleConfirm} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="w-4 h-4 mr-2" /> Confirmar Ação
                </Button>
              )}
            </div>
          </div>
        );
      case 'no_match':
        return (
          <div className="text-center py-4 space-y-4">
            <p className="text-lg font-bold text-destructive">Nenhum rosto detectado ou perfil não encontrado.</p>
            <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">Confirmação de Identidade</DialogTitle>
          <DialogDescription>
            Por favor, confirme sua identidade via reconhecimento facial para prosseguir.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {renderContent()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}