import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Cliente } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Check, X, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

type FacialRecognitionDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClientRecognized: (cliente: Cliente) => void;
  onNewClient: () => void;
};

export function FacialRecognitionDialog({ isOpen, onOpenChange, onClientRecognized, onNewClient }: FacialRecognitionDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [match, setMatch] = useState<Cliente | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Inicializando câmera...");

  const resetState = useCallback(() => {
    setIsScanning(false);
    setMatch(null);
    setSnapshot(null);
    setStatusMessage("Inicializando câmera...");
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const performRecognition = useCallback(async (imageUrl: string) => {
    setIsScanning(true);
    setMatch(null);
    setStatusMessage("Analisando...");

    try {
      const { data, error } = await supabase.functions.invoke('recognize-face', {
        body: { image_url: imageUrl },
      });

      if (error) throw error;

      setMatch(data.match || null);
    } catch (err: any) {
      showError(`Erro no reconhecimento: ${err.message}`);
      setMatch(null);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleUserMedia = useCallback(() => {
    setStatusMessage("Câmera pronta. Capturando imagem...");
    setTimeout(() => {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc && imageSrc.includes('base64,')) {
          setSnapshot(imageSrc);
          performRecognition(imageSrc);
        } else {
          showError("Não foi possível capturar uma imagem válida. Tente novamente.");
          onOpenChange(false);
        }
      }
    }, 500);
  }, [performRecognition, onOpenChange]);

  const handleConfirm = () => {
    if (match) {
      onClientRecognized(match);
      onOpenChange(false);
    }
  };

  const handleNewClient = () => {
    onNewClient();
    onOpenChange(false);
  };

  const handleRetry = () => {
    resetState();
    // A onUserMedia não dispara novamente, então re-executamos a lógica de captura manualmente.
    handleUserMedia();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Analisando Rosto</DialogTitle>
          <DialogDescription>Aguarde enquanto identificamos o cliente.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center bg-black">
            {snapshot ? (
              <img src={snapshot} alt="Rosto capturado" className="w-full h-full object-cover" />
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ width: 400, height: 400, facingMode: 'user' }}
                className="w-full h-full object-cover"
                onUserMedia={handleUserMedia}
                onUserMediaError={() => {
                  showError("Não foi possível acessar a câmera.");
                  onOpenChange(false);
                }}
              />
            )}
          </div>
          
          <div className="text-center h-24 flex flex-col justify-center items-center">
            {isScanning || (!snapshot && isOpen) ? (
              <p className="text-lg animate-pulse">{statusMessage}</p>
            ) : match ? (
              <div className="space-y-2">
                <p className="text-lg">Cliente reconhecido:</p>
                <p className="text-2xl font-bold">{match.nome}</p>
                <div className="flex gap-2 justify-center pt-2">
                  <Button variant="outline" onClick={handleRetry}><X className="w-4 h-4 mr-2" />Incorreto</Button>
                  <Button onClick={handleConfirm}><Check className="w-4 h-4 mr-2" />Confirmar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-bold text-red-600">Cliente não encontrado.</p>
                <div className="flex gap-2 justify-center pt-2">
                  <Button variant="outline" onClick={handleRetry}>Tentar Novamente</Button>
                  <Button onClick={handleNewClient}><UserPlus className="w-4 h-4 mr-2" />Cadastrar Novo Cliente</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}