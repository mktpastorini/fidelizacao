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
  const [usePreferredCamera, setUsePreferredCamera] = useState(true); // Estado para controle de fallback

  const actionLabel = targetStatus === 'preparando' ? 'Iniciar Preparo' : 'Finalizar Item';

  const resetState = useCallback(() => {
    setMatch(null);
    setSnapshot(null);
    setStatusMessage("Aponte a câmera para o rosto");
    setMediaError(null);
    setIsScanning(false);
    setUsePreferredCamera(true); // Tenta usar a preferida novamente ao reabrir
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleMediaError = useCallback((err: any) => {
    console.error("Erro ao acessar a câmera:", err);
    
    if (err.name === 'OverconstrainedError' && usePreferredCamera) {
      // Se falhar com a câmera preferida, tenta o fallback (sem deviceId)
      console.warn("OverconstrainedError com câmera preferida. Tentando fallback...");
      setUsePreferredCamera(false);
      setMediaError(null); // Limpa o erro para tentar novamente
      return;
    }
    
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setMediaError("Acesso à câmera negado. Por favor, permita o acesso nas configurações do seu navegador.");
    } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setMediaError("Acesso à câmera bloqueado. O sistema deve ser acessado via HTTPS.");
    } else {
      setMediaError(`Não foi possível acessar a câmera: ${err.message}`);
    }
  }, [usePreferredCamera]);

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
    // Usa o deviceId preferido APENAS se usePreferredCamera for true
    deviceId: usePreferredCamera && settings?.preferred_camera_device_id 
      ? { exact: settings.preferred_camera_device_id } 
      : undefined,
  };

  // DEFINIÇÃO DA FUNÇÃO renderContent
  const renderContent = () => {
    if (mediaError) {
      return (
        <div className="text-center h-24 flex flex-col justify-center items-center space-y-2">
          <p className="text-lg font-bold text-red-600">{mediaError}</p>
          <Button onClick={resetState}>Tentar Novamente</Button>
        </div>
      );
    }

    if (isScanning || isSubmitting) {
      return <div className="text-center h-24 flex flex-col justify-center items-center"><Loader2 className="w-8 h-8 animate-spin mb-2" /><p className="text-lg animate-pulse">{isSubmitting ? "Processando Ação..." : statusMessage}</p></div>;
    }
    
    if (snapshot && match) {
      return (
        <div className="text-center h-24 flex flex-col justify-center items-center space-y-2">
          <p className="text-lg">Ação de {actionLabel} por:</p>
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={match.avatar_url || undefined} />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
            <p className="text-2xl font-bold text-primary">{match.nome}</p>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}><Check className="w-4 h-4 mr-2" />Confirmar Ação</Button>
          </div>
        </div>
      );
    }
    
    if (snapshot && !match) {
      return (
        <div className="text-center h-24 flex flex-col justify-center items-center space-y-2">
          <p className="text-lg font-bold text-destructive">Cozinheiro não reconhecido.</p>
          <Button onClick={resetState}>Tentar Novamente</Button>
        </div>
      );
    }
    
    return <div className="text-center h-24 flex flex-col justify-center items-center"><Button onClick={handleCapture} disabled={isScanning}>Capturar Rosto</Button></div>;
  };
  // FIM DA DEFINIÇÃO DA FUNÇÃO renderContent

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