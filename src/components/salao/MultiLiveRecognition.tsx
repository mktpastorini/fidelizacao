import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useMultiFaceRecognition, FaceMatch } from '@/hooks/useMultiFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Video, VideoOff, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type MultiLiveRecognitionProps = {
  onClientRecognized?: (cliente: FaceMatch['client']) => void; // Opcional, para quando um cliente é reconhecido
};

export function MultiLiveRecognition({ onClientRecognized }: MultiLiveRecognitionProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const { isLoading: isScanning, error: recognitionError, recognizeMultiple } = useMultiFaceRecognition();
  
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [recognizedFaces, setRecognizedFaces] = useState<FaceMatch[]>([]);
  const [lastRecognitionTime, setLastRecognitionTime] = useState(0);
  const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoConstraints = {
    width: 640, // Aumentar a largura para melhor detecção
    height: 480, // Aumentar a altura
    deviceId: settings?.preferred_camera_device_id ? { exact: settings.preferred_camera_device_id } : undefined,
  };

  const drawRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  };

  const drawText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, bgColor: string) => {
    ctx.font = '16px Arial';
    ctx.fillStyle = bgColor;
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(x, y - 20, textWidth + 8, 24); // Background for text
    ctx.fillStyle = color;
    ctx.fillText(text, x + 4, y - 4);
  };

  const handleRecognition = useCallback(async () => {
    if (isScanning || !isCameraOn || !webcamRef.current || !canvasRef.current) return;

    const now = Date.now();
    if (now - lastRecognitionTime < 3000) return; // Scan a cada 3 segundos para performance

    setLastRecognitionTime(now);
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const video = webcamRef.current.video;
    if (!video) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar o tamanho do canvas para o tamanho real do vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Limpar o canvas antes de desenhar novos resultados
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const results = await recognizeMultiple(imageSrc);
    setRecognizedFaces(results);

    if (results.length > 0) {
      results.forEach(match => {
        const { box, client } = match;
        // Escalar as coordenadas da caixa para o tamanho do vídeo
        const scaleX = canvas.width / videoConstraints.width;
        const scaleY = canvas.height / videoConstraints.height;

        const x = box.x_min * scaleX;
        const y = box.y_min * scaleY;
        const width = (box.x_max - box.x_min) * scaleX;
        const height = (box.y_max - box.y_min) * scaleY;

        drawRect(ctx, x, y, width, height, '#4CAF50'); // Verde para reconhecido
        drawText(ctx, client.nome, x, y, 'white', '#4CAF50');

        // Opcional: Chamar onClientRecognized para o primeiro cliente reconhecido
        if (onClientRecognized) {
          onClientRecognized(client);
        }
      });
    }
  }, [isScanning, isCameraOn, lastRecognitionTime, recognizeMultiple, onClientRecognized, settings]);

  useEffect(() => {
    if (isCameraOn) {
      recognitionIntervalRef.current = setInterval(handleRecognition, 1000); // Tenta reconhecer a cada 1 segundo
    } else {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
      setRecognizedFaces([]); // Limpa os rostos reconhecidos quando a câmera é desligada
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    return () => {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
    };
  }, [isCameraOn, handleRecognition]);

  const handleMediaError = (err: any) => {
    console.error("Erro ao acessar a câmera no MultiLiveRecognition:", err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setMediaError("Acesso à câmera negado. Verifique as permissões do navegador.");
    } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setMediaError("Acesso à câmera bloqueado. O sistema deve ser acessado via HTTPS.");
    } else {
      setMediaError(`Erro de mídia: ${err.message}`);
    }
    setIsCameraOn(false);
  };

  const displayError = recognitionError || mediaError;

  return (
    <Card className="sticky top-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Multi-Reconhecimento Facial</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsCameraOn(prev => !prev)} disabled={!!mediaError}>
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-secondary flex items-center justify-center">
          {isCameraOn && !displayError ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover"
                mirrored={true}
                onUserMediaError={handleMediaError}
              />
              <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full transform scaleX(-1)" />
            </>
          ) : (
            <div className="flex flex-col items-center text-muted-foreground p-4">
              <VideoOff className="w-12 h-12 mb-2" />
              <p>{isCameraOn ? "Câmera indisponível" : "Câmera desligada"}</p>
            </div>
          )}
        </div>
        {displayError && <Alert variant="destructive"><AlertTitle>Erro</AlertTitle><AlertDescription>{displayError}</AlertDescription></Alert>}
        
        <div className="w-full h-24 flex items-center justify-center">
          {isScanning ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <p>Analisando múltiplos rostos...</p>
            </div>
          ) : recognizedFaces.length > 0 ? (
            <div className="text-center space-y-2 animate-in fade-in">
              <p className="text-sm text-muted-foreground">Clientes reconhecidos:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {recognizedFaces.map(face => (
                  <Badge key={face.client.id} className="flex items-center gap-1 bg-primary text-primary-foreground">
                    <Users className="w-3 h-3" /> {face.client.nome}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{isCameraOn ? "Aguardando clientes para multi-detecção..." : "Câmera pausada"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}