import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Cozinheiro, ItemPedido } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Camera, VideoOff, RefreshCw, User } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useCookRecognition } from '@/hooks/useCookRecognition';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';

type CookRecognitionModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: ItemPedido | null;
  action: 'preparando' | 'entregue';
  onCookConfirmed: (cookId: string) => void;
  requiredCookId?: string | null; // ID do cozinheiro que iniciou o preparo (para ação 'entregue')
};

export function CookRecognitionModal({ 
  isOpen, 
  onOpenChange, 
  item, 
  action, 
  onCookConfirmed, 
  requiredCookId 
}: CookRecognitionModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const [match, setMatch] = useState<Cozinheiro | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Aponte a câmera para o rosto");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const { isReady, isLoading: isScanning, error: recognitionError, recognize } = useCookRecognition();

  const resetState = useCallback(() => {
    setMatch(null);
    setSnapshot(null);
    setStatusMessage(isReady ? "Aponte a câmera para o rosto" : "Carregando...");
    setCameraError(null);
  }, [isReady]);

  useEffect(() => {
    if (isOpen) {
      const getDevices = async () => {
        try {
          const mediaDevices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
          setDevices(videoDevices);

          const savedCameraId = settings?.preferred_camera_device_id;
          const isSavedCameraAvailable = videoDevices.some(device => device.deviceId === savedCameraId);

          if (savedCameraId && isSavedCameraAvailable) {
            setSelectedDeviceId(savedCameraId);
          } else if (videoDevices.length > 0) {
            setSelectedDeviceId(videoDevices[0].deviceId);
          } else if (videoDevices.length === 0) {
            setCameraError("Nenhuma câmera encontrada.");
          }
        } catch (err) {
          console.error("Erro ao listar dispositivos de câmera:", err);
          setCameraError("Permissão para acessar a câmera negada.");
        }
      };
      getDevices();
      setStatusMessage(isReady ? "Aponte a câmera para o rosto" : "Carregando...");
    } else {
      resetState();
    }
  }, [isOpen, isReady, settings, resetState]);

  useEffect(() => {
    if (recognitionError) {
      showError(recognitionError);
      setStatusMessage("Erro no reconhecimento. Tente novamente.");
    }
  }, [recognitionError]);

  const performRecognition = useCallback(async (imageSrc: string) => {
    if (!isReady || !recognize) return;

    setStatusMessage("Analisando...");
    const result = await recognize(imageSrc);
    
    if (result) {
      const recognizedCook = result.cook;
      
      // Regra de validação: Se for ação 'entregue', deve ser o mesmo cozinheiro que iniciou o preparo
      if (action === 'entregue' && requiredCookId && recognizedCook.id !== requiredCookId) {
        setMatch(null);
        setStatusMessage(`Apenas ${item?.cozinheiro?.nome || 'o cozinheiro responsável'} pode finalizar este item.`);
        showError("Identificação falhou: Cozinheiro incorreto.");
        return;
      }
      
      setMatch(recognizedCook);
      setStatusMessage(`Cozinheiro reconhecido: ${recognizedCook.nome}`);
    } else {
      setMatch(null);
      setStatusMessage("Cozinheiro não encontrado.");
    }
  }, [isReady, recognize, action, requiredCookId, item?.cozinheiro?.nome]);

  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setSnapshot(imageSrc);
        performRecognition(imageSrc);
      } else {
        showError("Não foi possível capturar a imagem. Tente novamente.");
      }
    }
  }, [performRecognition]);

  const handleConfirm = () => {
    if (match) {
      onCookConfirmed(match.id);
      onOpenChange(false);
    }
  };

  const handleRetry = () => {
    setSnapshot(null);
    setMatch(null);
    setStatusMessage("Aponte a câmera para o rosto");
    setCameraError(null);
  };

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
  };

  const renderContent = () => {
    if (cameraError) {
      return (
        <div className="text-center h-24 flex flex-col justify-center items-center space-y-2">
          <p className="text-lg font-bold text-red-600">{cameraError}</p>
          <Button onClick={handleRetry}>Tentar Novamente</Button>
        </div>
      );
    }

    if (!isReady) {
      return <div className="text-center h-24 flex flex-col justify-center items-center"><Loader2 className="w-8 h-8 animate-spin mb-2" /><p className="text-lg">{statusMessage}</p></div>;
    }
    if (isScanning) {
      return <div className="text-center h-24 flex flex-col justify-center items-center"><Loader2 className="w-8 h-8 animate-spin mb-2" /><p className="text-lg animate-pulse">{statusMessage}</p></div>;
    }
    if (snapshot && match) {
      return (
        <div className="text-center h-24 flex flex-col justify-center items-center space-y-2">
          <p className="text-lg">Cozinheiro reconhecido:</p>
          <div className="flex items-center justify-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={match.avatar_url || undefined} />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
            <p className="text-2xl font-bold text-primary">{match.nome}</p>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={handleRetry}><X className="w-4 h-4 mr-2" />Incorreto</Button>
            <Button onClick={handleConfirm}><Check className="w-4 h-4 mr-2" />Confirmar {action === 'preparando' ? 'Início' : 'Entrega'}</Button>
          </div>
        </div>
      );
    }
    if (snapshot && !match) {
      return <div className="text-center h-24 flex flex-col justify-center items-center space-y-2"><p className="text-lg font-bold text-destructive">Cozinheiro não encontrado.</p><div className="flex gap-2 justify-center pt-2"><Button variant="outline" onClick={handleRetry}>Tentar Novamente</Button></div></div>;
    }
    return <div className="text-center h-24 flex flex-col justify-center items-center"><Button onClick={handleCapture} disabled={!!cameraError}><Camera className="w-4 h-4 mr-2" /> Capturar Rosto</Button></div>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        resetState();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmação Facial</DialogTitle>
          <DialogDescription>
            {action === 'preparando' ? 'Confirme sua identidade para iniciar o preparo.' : 'Confirme sua identidade para marcar como pronto.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center bg-black">
            {snapshot ? <img src={snapshot} alt="Rosto capturado" className="w-full h-full object-cover" /> : 
             cameraError ? <div className="w-full h-full flex items-center justify-center text-white bg-red-500 p-4 text-center">
                <p>{cameraError}</p>
             </div> :
             <Webcam 
               audio={false} 
               ref={webcamRef} 
               screenshotFormat="image/jpeg" 
               videoConstraints={videoConstraints} 
               className="w-full h-full object-cover" 
               onUserMediaError={(e) => {
                 console.error("Erro ao acessar a câmera:", e);
                 setCameraError("Não foi possível acessar a câmera. Verifique as permissões ou tente outra câmera.");
               }} 
             />
            }
          </div>
          {!snapshot && !cameraError && devices.length > 1 && (
            <Select value={selectedDeviceId || ''} onValueChange={setSelectedDeviceId}>
              <SelectTrigger className="w-full max-w-xs"><SelectValue placeholder="Selecione uma câmera" /></SelectTrigger>
              <SelectContent>{devices.map((device) => (<SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Câmera ${devices.indexOf(device) + 1}`}</SelectItem>))}</SelectContent>
            </Select>
          )}
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}