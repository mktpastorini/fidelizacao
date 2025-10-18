import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Cliente } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, User, Video, VideoOff } from 'lucide-react';
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
  const [recognizedClient, setRecognizedClient] = useState<Cliente | null>(null);
  const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: settings?.preferred_camera_device_id ? { exact: settings.preferred_camera_device_id } : undefined,
  };

  const handleRecognition = useCallback(async () => {
    if (isScanning || !isCameraOn || !webcamRef.current) return;

    const now = Date.now();
    if (now - lastRecognitionTime < 5000) return; // Scan every 5 seconds

    setLastRecognitionTime(now);
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const result = await recognize(imageSrc);
    if (result?.client) {
      setRecognizedClient(result.client);
      onClientRecognized(result.client);
    } else {
      setRecognizedClient(null);
    }
  }, [isScanning, isCameraOn, lastRecognitionTime, recognize, onClientRecognized]);

  useEffect(() => {
    if (isCameraOn && isReady) {
      recognitionIntervalRef.current = setInterval(handleRecognition, 2000); // Check every 2 seconds
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
  }, [isCameraOn, isReady, handleRecognition]);

  return (
    <Card className="sticky top-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Câmera de Reconhecimento</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsCameraOn(prev => !prev)}>
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="w-full aspect-video rounded-lg overflow-hidden border bg-secondary flex items-center justify-center">
          {isCameraOn ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover"
              mirrored={true}
            />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <VideoOff className="w-12 h-12 mb-2" />
              <p>Câmera desligada</p>
            </div>
          )}
        </div>
        {error && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        
        <div className="w-full h-24 flex items-center justify-center">
          {isScanning ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <p>Analisando...</p>
            </div>
          ) : recognizedClient ? (
            <div className="text-center space-y-2 animate-in fade-in">
              <p className="text-sm text-muted-foreground">Bem-vindo(a) de volta!</p>
              <div className="flex items-center justify-center gap-2">
                <Avatar>
                  <AvatarImage src={recognizedClient.avatar_url || undefined} />
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <p className="text-xl font-bold">{recognizedClient.nome}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{isCameraOn ? "Aguardando clientes..." : "Câmera pausada"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}