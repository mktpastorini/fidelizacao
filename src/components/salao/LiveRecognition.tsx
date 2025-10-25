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

export function LiveRecognition({ onClientRecognized }: LiveRecognitionProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isScanning, error, recognize } = useFaceRecognition();
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [lastRecognitionTime, setLastRecognitionTime] = useState(0);
  const [recognitionResult, setRecognitionResult] = useState<FaceRecognitionResult>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: settings?.preferred_camera_device_id || undefined,
  };

  const handleRecognition = useCallback(async (manualTrigger = false) => {
    if (isScanning || !isCameraOn || !webcamRef.current) return;

    const now = Date.now();
    if (!manualTrigger && (now - lastRecognitionTime < 5000)) return; // Scan every 5 seconds automatically

    console.log(`[LiveRecognition] Iniciando varredura... (Manual: ${manualTrigger})`);
    setLastRecognitionTime(now);
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      console.warn("[LiveRecognition] Não foi possível capturar a imagem da webcam.");
      return;
    }

    const result = await recognize(imageSrc);
    setRecognitionResult(result);
    
    if (result?.status === 'MATCH_FOUND' && result.match) {
      console.log(`[LiveRecognition] Cliente reconhecido: ${result.match.nome} com similaridade de ${result.similarity}`);
      onClientRecognized(result.match);
    } else {
      console.log(`[LiveRecognition] Nenhum match. Status: ${result?.status}, Mensagem: ${result?.message}`);
    }
  }, [isScanning, isCameraOn, lastRecognitionTime, recognize, onClientRecognized]);

  // Efeito para o scan automático
  useEffect(() => {
    if (isCameraOn && isReady && isCameraReady) {
      recognitionIntervalRef.current = setInterval(() => handleRecognition(false), 2000); // Check every 2 seconds
    } else {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
    }

    return () => {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
    };
  }, [isCameraOn, isReady, isCameraReady, handleRecognition]);

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

    if (recognitionResult?.status === 'MATCH_FOUND' && recognitionResult.match) {
      return (
        <div className="text-center space-y-2 animate-in fade-in">
          <p className="text-sm text-muted-foreground">Bem-vindo(a) de volta!</p>
          <div className="flex items-center justify-center gap-2">
            <Avatar>
              <AvatarImage src={recognitionResult.match.avatar_url || undefined} />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
            <p className="text-xl font-bold">{recognitionResult.match.nome}</p>
          </div>
          <p className="text-xs text-muted-foreground">Similaridade: {(recognitionResult.similarity! * 100).toFixed(1)}%</p>
        </div>
      );
    }

    if (recognitionResult?.status === 'NO_MATCH') {
      return <p className="text-muted-foreground">{recognitionResult.message || "Rosto detectado, mas não reconhecido."}</p>;
    }

    if (recognitionResult?.status === 'NO_FACE_DETECTED') {
      return <p className="text-muted-foreground">{recognitionResult.message || "Nenhum rosto detectado."}</p>;
    }

    return <p className="text-muted-foreground">{isCameraOn ? "Aguardando clientes..." : "Câmera pausada"}</p>;
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