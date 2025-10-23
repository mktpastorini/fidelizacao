import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Cozinheiro, ItemPedido } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Camera, RefreshCw, User } from 'lucide-react';
import { showError } from '@/utils/toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/contexts/SettingsContext';

type CookRecognitionModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: ItemPedido | null;
  targetStatus: 'preparando' | 'entregue';
  onCookConfirmed: (itemId: string, newStatus: 'preparando' | 'entregue', cookId: string) => void;
  isSubmitting: boolean;
};

type RecognitionResult = {
  match: Cozinheiro;
  similarity: number;
} | null;

export function CookRecognitionModal({ 
  isOpen, 
  onOpenChange, 
  item, 
  targetStatus, 
  onCookConfirmed, 
  isSubmitting 
}: CookRecognitionModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const [match, setMatch] = useState<Cozinheiro | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Aponte a câmera para o rosto");
  const [isScanning, setIsScanning] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const actionLabel = targetStatus === 'preparando' ? 'Iniciar Preparo' : 'Finalizar Item';

  const resetState = useCallback(() => {
    setMatch(null);
    setSnapshot(null);
    setStatusMessage("Aponte a câmera para o rosto");
    setMediaError(null);
    setIsScanning(false);
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
    setStatusMessage("Analisando...");
    setIsScanning(true);
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-cook-face', {
        body: { image_url: imageSrc },
      });

      if (functionError) throw functionError;

      if (data.match) {
        setMatch(data.match as Cozinheiro);
        setStatusMessage(`Cozinheiro reconhecido: ${data.match.nome}`);
      } else {
        setMatch(null);
        setStatusMessage("Cozinheiro não reconhecido.");
      }

    } catch (err: any) {
      console.error("Erro no reconhecimento facial do cozinheiro:", err);
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o serviço de reconhecimento.";
      showError(errorMessage);
      setStatusMessage("Erro no reconhecimento. Tente novamente.");
    } finally {
      setIsScanning(false);
    }
  }, []);

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
        showError("Não foi possível capturar a imagem.");
      }
    }
  }, [performRecognition, mediaError]);

  const handleConfirm = () => {
    if (match && item) {
      onCookConfirmed(item.id, targetStatus, match.id);
    }
  };

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: settings?.preferred_camera_device_id ? { exact: settings.preferred_camera_device_id } : undefined,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmação Facial</DialogTitle>
          <DialogDescription>
            Confirme sua identidade para {actionLabel.toLowerCase()} o item: <span className="font-semibold">{item?.nome_produto}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center bg-black">
            {snapshot ? <img src={snapshot} alt="Rosto capturado" className="w-full h-full object-cover" id="cook-recognition-snapshot" /> : 
             mediaError ? <div className="w-full h-full flex items-center justify-center text-white bg-red-500 p-4 text-center">
                <p>{mediaError}</p>
             </div> :
             <Webcam 
               audio={false} 
               ref={webcamRef} 
               screenshotFormat="image/jpeg" 
               videoConstraints={videoConstraints} 
               className="w-full h-full object-cover" 
               mirrored={true}
               onUserMediaError={handleMediaError} 
             />
            }
          </div>
          {renderContent()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}