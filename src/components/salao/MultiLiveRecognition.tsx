import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useMultiFaceRecognition, FaceMatch } from '@/hooks/useMultiFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Video, VideoOff, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type RecognizedClientDisplay = {
  client: FaceMatch['client'];
  timestamp: number;
};

type MultiLiveRecognitionProps = {
  onRecognizedFacesUpdate: (clients: RecognizedClientDisplay[]) => void;
  allocatedClientIds: string[]; // Nova prop
};

const PERSISTENCE_DURATION_MS = 30 * 1000; // 30 segundos

export function MultiLiveRecognition({ onRecognizedFacesUpdate, allocatedClientIds }: MultiLiveRecognitionProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettings();
  const { isLoading: isScanning, error: recognitionError, recognizeMultiple } = useMultiFaceRecognition();
  
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [recognizedFaces, setRecognizedFaces] = useState<FaceMatch[]>([]); // Para desenhar caixas
  const [persistentRecognizedClients, setPersistentRecognizedClients] = useState<RecognizedClientDisplay[]>([]); // Para o painel
  const [lastRecognitionTime, setLastRecognitionTime] = useState(0);
  const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoConstraints = {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    facingMode: "user",
    deviceId: settings?.preferred_camera_device_id ? { exact: settings.preferred_camera_device_id } : undefined,
  };

  const drawRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  };

  const drawClientInfo = (
    ctx: CanvasRenderingContext2D,
    client: FaceMatch['client'],
    box: FaceMatch['box'],
    scaleX: number,
    scaleY: number,
    canvasWidth: number
  ) => {
    // Coordenadas originais da caixa
    const x_original = box.x_min * scaleX;
    const y_original = box.y_min * scaleY;
    const width_original = (box.x_max - box.x_min) * scaleX;

    // Ajustar para a exibição espelhada da webcam
    const x_mirrored = canvasWidth - (x_original + width_original);
    const y_text_start = y_original;

    const infoLines: string[] = [];
    infoLines.push(client.nome);
    if (client.casado_com) {
      infoLines.push(`Cônjuge: ${client.casado_com}`);
    }
    if (client.gostos) {
      const preferences = Object.entries(client.gostos)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`);
      if (preferences.length > 0) {
        infoLines.push(...preferences);
      }
    }
    infoLines.push(`Visitas: ${client.visitas || 0}`);

    const lineHeight = 20;
    const padding = 5;
    
    ctx.font = '16px Arial';
    let maxWidth = 0;
    infoLines.forEach(line => {
      const textWidth = ctx.measureText(line).width;
      if (textWidth > maxWidth) maxWidth = textWidth;
    });

    const boxHeight = (infoLines.length * lineHeight) + (2 * padding);
    const boxWidth = maxWidth + (2 * padding);
    
    // Posição do fundo do texto (acima da caixa do rosto)
    const backgroundY = y_text_start - boxHeight - padding;
    
    // Desenhar fundo do texto
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Fundo escuro semi-transparente
    ctx.fillRect(x_mirrored, backgroundY, boxWidth, boxHeight);

    // Desenhar cada linha de texto
    ctx.fillStyle = 'white';
    infoLines.forEach((line, index) => {
      ctx.fillText(line, x_mirrored + padding, backgroundY + padding + (index * lineHeight) + (lineHeight * 0.75));
    });
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
    setRecognizedFaces(results); // Atualiza para desenhar as caixas

    // Atualiza a lista persistente, filtrando clientes já alocados
    setPersistentRecognizedClients(prevClients => {
      const updatedClients = [...prevClients];
      const currentClientIds = new Set(prevClients.map(c => c.client.id));
      const allocatedSet = new Set(allocatedClientIds); // Clientes já alocados

      results.forEach(match => {
        // Só adiciona/atualiza se o cliente NÃO estiver alocado
        if (!allocatedSet.has(match.client.id)) {
          if (currentClientIds.has(match.client.id)) {
            // Atualiza o timestamp se o cliente já existe
            const index = updatedClients.findIndex(c => c.client.id === match.client.id);
            if (index !== -1) {
              updatedClients[index].timestamp = now;
            }
          } else {
            // Adiciona novo cliente
            updatedClients.push({ client: match.client, timestamp: now });
          }
        }
      });
      // Filtra clientes que foram alocados enquanto estavam na lista persistente
      return updatedClients.filter(c => !allocatedSet.has(c.client.id));
    });

    if (results.length > 0) {
      results.forEach(match => {
        const { box, client } = match;
        // Escalar as coordenadas da caixa para o tamanho do vídeo
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        const x_original = box.x_min * scaleX;
        const y_original = box.y_min * scaleY;
        const width_original = (box.x_max - box.x_min) * scaleX;
        const height_original = (box.y_max - box.y_min) * scaleY;

        // Ajustar para a exibição espelhada da webcam
        const x_mirrored = canvas.width - (x_original + width_original);

        drawRect(ctx, x_mirrored, y_original, width_original, height_original, '#4CAF50'); // Verde para reconhecido
        drawClientInfo(ctx, client, box, scaleX, scaleY, canvas.width); // Desenha as informações do cliente
      });
    }
  }, [isScanning, isCameraOn, lastRecognitionTime, recognizeMultiple, settings, allocatedClientIds]);

  useEffect(() => {
    if (isCameraOn) {
      recognitionIntervalRef.current = setInterval(handleRecognition, 1000); // Tenta reconhecer a cada 1 segundo
      cleanupIntervalRef.current = setInterval(() => {
        setPersistentRecognizedClients(prevClients => {
          const now = Date.now();
          // Remove clientes que expiraram ou foram alocados
          const allocatedSet = new Set(allocatedClientIds);
          return prevClients.filter(c => (now - c.timestamp) < PERSISTENCE_DURATION_MS && !allocatedSet.has(c.client.id));
        });
      }, 5000); // Limpa a cada 5 segundos
    } else {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      setRecognizedFaces([]);
      setPersistentRecognizedClients([]);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    return () => {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [isCameraOn, handleRecognition, allocatedClientIds]); // Adicionado allocatedClientIds como dependência

  useEffect(() => {
    onRecognizedFacesUpdate(persistentRecognizedClients);
  }, [persistentRecognizedClients, onRecognizedFacesUpdate]);

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
    <Card className="sticky top-6 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between shrink-0">
        <CardTitle>Multi-Reconhecimento Facial</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsCameraOn(prev => !prev)} disabled={!!mediaError}>
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center gap-4 p-4 pt-0">
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
        
        <div className="w-full h-24 flex items-center justify-center shrink-0">
          {isScanning ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <p>Analisando múltiplos rostos...</p>
            </div>
          ) : recognizedFaces.length > 0 ? (
            <div className="text-center space-y-2 animate-in fade-in">
              <p className="text-sm text-muted-foreground">Rostos detectados:</p>
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