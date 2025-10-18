import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Cliente } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, UserPlus, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';

type FacialRecognitionDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClientRecognized: (cliente: Cliente) => void;
  onNewClient: () => void;
};

export function FacialRecognitionDialog({ isOpen, onOpenChange, onClientRecognized, onNewClient }: FacialRecognitionDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const [match, setMatch] = useState<Cliente | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Inicializando...");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const { isReady, isLoading: isScanning, error: recognitionError, recognize } = useFaceRecognition();

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
          } else {
            setCameraError("Nenhuma câmera encontrada. Verifique se uma câmera está conectada.");
          }
        } catch (err) {
          console.error("Erro ao listar dispositivos de câmera:", err);
          setCameraError("Permissão para acessar a câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.");
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
      setMatch(result.client);
      setStatusMessage(`Reconhecido: ${result.client.nome}`);
    } else {
      setMatch(null);
      setStatusMessage("Cliente não encontrado.");
    }
  }, [isReady, recognize]);

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
      onClientRecognized(match);
      onOpenChange(false);
    }
  };

  const handleNewClient = () => {
    onNewClient();
    onOpenChange(false);
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
      return <div className="text-center h-24 flex flex-col justify-center items-center space-y-2"><p className="text-lg">Cliente reconhecido:</p><p className="text-2xl font-bold">{match.nome}</p><div className="flex gap-2 justify-center pt-2"><Button variant="outline" onClick={handleRetry}><X className="w-4 h-4 mr-2" />Incorreto</Button><Button onClick={handleConfirm}><Check className="w-4 h-4 mr-2" />Confirmar</Button></div></div>;
    }
    if (snapshot && !match) {
      return <div className="text-center h-24 flex flex-col justify-center items-center space-y-2"><p className="text-lg font-bold text-red-600">Cliente não encontrado.</p><div className="flex gap-2 justify-center pt-2"><Button variant="outline" onClick={handleRetry}>Tentar Novamente</Button><Button onClick={handleNewClient}><UserPlus className="w-4 h-4 mr-2" />Cadastrar Novo Cliente</Button></div></div>;
    }
    return <div className="text-center h-24 flex flex-col justify-center items-center"><Button onClick={handleCapture}>Capturar Imagem</Button></div>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        resetState();
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reconhecimento Facial</DialogTitle><DialogDescription>{statusMessage}</DialogDescription></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center bg-black">
            {snapshot ? <img src={snapshot} alt="Rosto capturado" className="w-full h-full object-cover" /> : 
             cameraError ? <div className="w-full h-full flex items-center justify-center text-white bg-red-500">Erro</div> :
             <Webcam 
               audio={false} 
               ref={webcamRef} 
               screenshotFormat="image/jpeg" 
               videoConstraints={videoConstraints} 
               className="w-full h-full object-cover" 
               onUserMediaError={(e) => {
                 console.error("Erro ao acessar a câmera:", e);
                 setCameraError("Não foi possível acessar a câmera. Verifique as permissões ou tente outra câmera.");
                 onOpenChange(false);
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