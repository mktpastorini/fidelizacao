import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Camera, VideoOff, RefreshCw, User } from 'lucide-react';
import { showError } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type CookRecognitionModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCookRecognized: (imageUrl: string) => void;
  isSubmitting: boolean;
  actionTitle: string;
};

// Hook de reconhecimento facial simplificado para a cozinha
function useCookRecognition() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (imageSrc: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Chamamos o Edge Function que faz o reconhecimento
      const { data, error: functionError } = await supabase.functions.invoke('recognize-face-compreface', {
        body: { image_url: imageSrc },
      });

      if (functionError) throw functionError;

      setIsLoading(false);
      if (data.match) {
        // O match.id será o ID do cliente/cozinheiro no CompreFace
        return { id: data.match.id, nome: data.match.nome, avatar_url: data.match.avatar_url };
      }
      return null;

    } catch (err: any) {
      console.error("Erro ao invocar a função de reconhecimento:", err);
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o serviço de reconhecimento.";
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, []);

  return { isLoading, error, recognize };
}


export function CookRecognitionModal({ isOpen, onOpenChange, onCookRecognized, isSubmitting, actionTitle }: CookRecognitionModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isLoading: isScanning, error: recognitionError, recognize } = useCookRecognition();
  
  const [match, setMatch] = useState<{ id: string, nome: string, avatar_url: string | null } | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setMatch(null);
    setSnapshot(null);
    setMediaError(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
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
            setMediaError("Nenhuma câmera encontrada.");
          }
        } catch (err) {
          setMediaError("Permissão para acessar a câmera negada.");
        }
      };
      getDevices();
    }
  }, [isOpen, settings, resetState]);

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
  };

  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setSnapshot(imageSrc);
        // Não fazemos o reconhecimento aqui, apenas capturamos a imagem
      } else {
        showError("Não foi possível capturar a imagem.");
      }
    }
  }, []);
  
  const handleRecognition = useCallback(async () => {
    if (!snapshot) return;
    const result = await recognize(snapshot);
    
    if (result) {
      setMatch(result);
    } else {
      setMatch({ id: 'none', nome: 'Não Reconhecido', avatar_url: null });
    }
  }, [snapshot, recognize]);

  const handleConfirm = () => {
    if (snapshot && match && match.id !== 'none') {
      onCookRecognized(snapshot);
      onOpenChange(false);
    }
  };

  const handleRetry = () => {
    resetState();
  };

  const displayError = recognitionError || mediaError;
  const isRecognized = match && match.id !== 'none';
  const isNotRecognized = match && match.id === 'none';

  const renderStatus = () => {
    if (displayError) {
      return <p className="text-lg font-bold text-destructive">{displayError}</p>;
    }
    if (isScanning) {
      return <div className="flex items-center"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analisando...</div>;
    }
    if (isRecognized) {
      return (
        <div className="flex flex-col items-center space-y-2">
          <Avatar className="w-16 h-16">
            <AvatarImage src={match.avatar_url || undefined} />
            <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
          </Avatar>
          <p className="text-xl font-bold text-primary">Bem-vindo(a), {match.nome}!</p>
        </div>
      );
    }
    if (isNotRecognized) {
      return <p className="text-lg font-bold text-destructive">Cozinheiro não reconhecido.</p>;
    }
    return <p className="text-lg text-muted-foreground">Aguardando captura...</p>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmação Facial</DialogTitle>
          <DialogDescription>
            {actionTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center bg-black">
            {snapshot ? (
              <img src={snapshot} alt="Rosto capturado" className="w-full h-full object-cover" />
            ) : displayError ? (
              <div className="text-center p-4 text-destructive">
                <p className="font-semibold">Erro de Câmera</p>
                <p className="text-sm">{displayError}</p>
              </div>
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover"
                mirrored={true}
                onUserMediaError={(e) => setMediaError("Não foi possível acessar a câmera.")}
              />
            )}
          </div>
          {!snapshot && devices.length > 1 && !displayError && (
            <Select value={selectedDeviceId || ''} onValueChange={setSelectedDeviceId}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Selecione uma câmera" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Câmera ${devices.indexOf(device) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="h-16 flex items-center justify-center">{renderStatus()}</div>
        </div>
        <DialogFooter>
          {snapshot && !isScanning && (
            <Button variant="outline" onClick={handleRetry} disabled={isSubmitting}>
              <RefreshCw className="w-4 h-4 mr-2" /> Tentar Novamente
            </Button>
          )}
          {!snapshot && !displayError && (
            <Button onClick={handleCapture} disabled={isScanning || isSubmitting}>
              <Camera className="w-4 h-4 mr-2" /> Capturar Rosto
            </Button>
          )}
          {snapshot && !isScanning && !match && (
            <Button onClick={handleRecognition} disabled={isSubmitting}>
              <Check className="w-4 h-4 mr-2" /> Confirmar Identidade
            </Button>
          )}
          {isRecognized && (
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Confirmar Ação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}