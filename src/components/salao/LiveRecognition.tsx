import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useFaceRecognition, FaceRecognitionResult } from '@/hooks/useFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Cliente } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, User, Video, VideoOff, Camera, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type LiveRecognitionProps = {
  onClientRecognized: (cliente: Cliente) => void;
};

const PERSISTENCE_DURATION_MS = 10000; // Manter o resultado por 10 segundos
const SCAN_INTERVAL_MS = 2000; // A cada 2 segundos

export function LiveRecognition({ onClientRecognized }: LiveRecognitionProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isScanning, error, recognize } = useFaceRecognition();
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [persistentClient, setPersistentClient] = useState<{ client: Cliente; timestamp: number } | null>(null);
  const [lastStatusMessage, setLastStatusMessage] = useState("Aguardando clientes...");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: settings?.preferred_camera_device_id || undefined,
  };

  const handleRecognition = useCallback(async (manualTrigger = false) => {
    if (!manualTrigger && persistentClient) return;
    if (!isCameraOn || !webcamRef.current || isScanning) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const result = await recognize(imageSrc);
    
    if (result?.status === 'MATCH_FOUND' && result.match) {
      if (persistentClient?.client.id !== result.match.id) {
        const newPersistentClient = { client: result.match, timestamp: Date.now() };
        setPersistentClient(newPersistentClient);
        onClientRecognized(result.match);
      }
    } else if (result?.message) {
      setLastStatusMessage(result.message);
    }
  }, [isCameraOn, isScanning, recognize, onClientRecognized, persistentClient]);

  // Efeito para o scan automático com loop estável
  useEffect(() => {
    let isLoopRunning = true;

    const scanLoop = async () => {
      if (!isLoopRunning) return;

      if (isCameraOn && isReady && isCameraReady && !isScanning && !persistentClient) {
        await handleRecognition(false);
      }

      if (isLoopRunning) {
        setTimeout(scanLoop, SCAN_INTERVAL_MS);
      }
    };

    const timeoutId = setTimeout(scanLoop, 500); // Inicia o loop

    return () => {
      isLoopRunning = false;
      clearTimeout(timeoutId);
    };
  }, [isCameraOn, isReady, isCameraReady, isScanning, persistentClient, handleRecognition]);

  // Efeito para limpar o cliente persistente após o tempo de expiração
  useEffect(() => {
    if (!persistentClient) return;

    const timeoutId = setTimeout(() => {
      const now = Date.now();
      if (now - persistentClient.timestamp >= PERSISTENCE_DURATION_MS) {
        setPersistentClient(null);
        setLastStatusMessage("Aguardando clientes...");
      }
    }, PERSISTENCE_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [persistentClient]);

  const handleMediaError = (err: any) => {
    console.error("[LiveRecognition] Erro ao acessar a câmera:", err);
    let errorMessage = `Erro de mídia: ${err.message}`;
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage = "Acesso à câmera negado. Verifique as permissões do navegador.";
    } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      errorMessage = "Acesso à câmera bloqueado. O sistema deve ser acessado via HTTPS.";
    }
    setMediaError(errorMessage);
    setIsCameraOn(false);
    setIsCameraReady(false);
  };

  const displayError = error || mediaError;

  const renderStatus = () => {
    if (isScanning) {
      return (
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p>Analisando...</p>
        </div>
      );
    }

    if (persistentClient) {
      return (
        <div className="text-center space-y-2 animate-in fade-in">
          <p className="text-sm text-muted-foreground">Bem-vindo(a) de volta!</p>
          <div className="flex items-center justify-center gap-2">
            <Avatar>
              <AvatarImage src={persistentClient.client.avatar_url || undefined} />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
            <p className="text-xl font-bold">{persistentClient.client.nome}</p>
          </div>
        </div>
      );
    }

    return <p className="text-muted-foreground">{isCameraOn ? lastStatusMessage : "Câmera pausada"}</p>;
  };

  return (
    <Card className="sticky top-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Câmera de Reconhecimento</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsCameraOn(prev => !prev)} disabled={!!mediaError}>
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="w-full aspect-video rounded-lg overflow-hidden border bg-secondary flex items-center justify-center">
          {isCameraOn && !displayError ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover"
              mirrored={true}
              onUserMedia={() => setIsCameraReady(true)}
              onUserMediaError={handleMediaError}
            />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground p-4">
              <VideoOff className="w-12 h-12 mb-2" />
              <p>{isCameraOn ? "Câmera indisponível" : "Câmera desligada"}</p>
            </div>
          )}
        </div>
        {displayError && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{displayError}</AlertDescription></Alert>}
        
        <div className="w-full h-24 flex items-center justify-center">
          {renderStatus()}
        </div>
        
        <Button 
          onClick={() => handleRecognition(true)} 
          disabled={!isCameraOn || isScanning || !!displayError || !isCameraReady}
          className="w-full"
        >
          {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
          {isScanning ? "Analisando..." : "Tirar Foto e Testar"}
        </Button>
      </CardContent>
    </Card>
  );
}