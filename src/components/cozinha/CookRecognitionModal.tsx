import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Cozinheiro, ItemPedido } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Camera, VideoOff, RefreshCw, User, Utensils } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useCookRecognition } from '@/hooks/useCookRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnimatedContent } from '../AnimatedContent'; // Importado

type CookRecognitionModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: ItemPedido & { pedido: { mesa: { numero: number } | null } | null } | null;
  action: 'start_prep' | 'finish_prep';
  onCookRecognized: (cook: Cozinheiro) => void;
};

export function CookRecognitionModal({ isOpen, onOpenChange, item, action, onCookRecognized }: CookRecognitionModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isLoading: isScanning, error: recognitionError, recognize } = useCookRecognition();
  
  const [match, setMatch] = useState<Cozinheiro | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Aponte a câmera para o rosto");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const isStartPrep = action === 'start_prep';
  const isFinishPrep = action === 'finish_prep';

  const resetState = useCallback(() => {
    setMatch(null);
    setSnapshot(null);
    setStatusMessage("Aponte a câmera para o rosto");
    setCameraError(null);
  }, []);

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
      resetState();
    }
  }, [isOpen, settings, resetState]);

  useEffect(() => {
    if (recognitionError) {
      showError(recognitionError);
      setStatusMessage("Erro no reconhecimento. Tente novamente.");
    }
  }, [recognitionError]);

  const performRecognition = useCallback(async (imageSrc: string) => {
    setStatusMessage("Analisando...");
    const result = await recognize(imageSrc);
    
    if (result?.cook) {
      setMatch(result.cook);
      setStatusMessage(`Cozinheiro(a) reconhecido(a): ${result.cook.nome}`);
    } else {
      setMatch(null);
      setStatusMessage("Cozinheiro(a) não encontrado(a).");
    }
  }, [recognize]);

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
      onCookRecognized(match);
      onOpenChange(false);
    }
  };

  const handleRetry = () => {
    resetState();
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

    if (isScanning) {
      return <div className="text-center h-24 flex flex-col justify-center items-center"><Loader2 className="w-8 h-8 animate-spin mb-2" /><p className="text-lg animate-pulse">{statusMessage}</p></div>;
    }
    
    if (snapshot && match) {
      return (
        <div className="text-center h-24 flex flex-col justify-center items-center space-y-2">
          <p className="text-lg">Confirmar identidade:</p>
          <div className="flex items-center justify-center gap-2">
            <Avatar>
              <AvatarImage src={match.avatar_url || undefined} />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
            <p className="text-2xl font-bold">{match.nome}</p>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={handleRetry}><X className="w-4 h-4 mr-2" />Incorreto</Button>
            <Button onClick={handleConfirm}><Check className="w-4 h-4 mr-2" />Confirmar</Button>
          </div>
        </div>
      );
    }
    
    if (snapshot && !match) {
      return (
        <div className="text-center h-24 flex flex-col justify-center items-center space-y-2">
          <p className="text-lg font-bold text-red-600">Cozinheiro(a) não encontrado(a).</p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={handleRetry}>Tentar Novamente</Button>
          </div>
        </div>
      );
    }
    
    return <div className="text-center h-24 flex flex-col justify-center items-center"><Button onClick={handleCapture} disabled={!!cameraError}><Camera className="w-4 h-4 mr-2" /> Capturar Rosto</Button></div>;
  };

  const title = isStartPrep ? "Iniciar Preparo" : "Finalizar Preparo";
  const itemInfo = item ? `${item.nome_produto} (Mesa ${item.pedido?.mesa?.numero || '?'})` : 'Item do Pedido';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        resetState();
      }
    }}>
      <DialogContent className="max-w-md">
        <AnimatedContent distance={50} duration={0.5} delay={0.1} className="w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Utensils className="w-6 h-6" /> {title}</DialogTitle>
            <DialogDescription>
              Confirme sua identidade para {isStartPrep ? 'iniciar o preparo' : 'marcar como pronto'} do item: <span className="font-semibold">{itemInfo}</span>
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
                mirrored={true}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isScanning}>Cancelar</Button>
          </DialogFooter>
        </AnimatedContent>
      </DialogContent>
    </Dialog>
  );
}