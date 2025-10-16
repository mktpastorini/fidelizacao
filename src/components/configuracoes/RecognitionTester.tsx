import { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Camera, Search, User, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function RecognitionTester() {
  const webcamRef = useRef<Webcam>(null);
  const { isReady, isLoading, error, recognize, getClientById } = useFaceRecognition();
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [matchResult, setMatchResult] = useState<{ name: string; distance: number; avatar: string | null } | 'not_found' | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    };
    getDevices();
  }, []);

  const handleScan = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setSnapshot(imageSrc);
    setIsScanning(true);
    setMatchResult(null);

    const image = new Image();
    image.src = imageSrc;
    image.onload = async () => {
      const result = await recognize(image);
      if (result && result.label !== 'unknown') {
        const client = getClientById(result.label);
        setMatchResult({
          name: client?.nome || 'Desconhecido',
          distance: result.distance,
          avatar: client?.avatar_url || null,
        });
      } else {
        setMatchResult('not_found');
      }
      setIsScanning(false);
    };
  }, [recognize, getClientById]);

  const reset = () => {
    setSnapshot(null);
    setMatchResult(null);
  };

  if (error) {
    return <Alert variant="destructive"><AlertTitle>Erro Crítico</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin mr-2" /> Carregando modelos de IA...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 flex flex-col items-center gap-4">
            <div className="w-full max-w-xs aspect-square rounded-lg overflow-hidden border bg-secondary">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined, width: 400, height: 400 }}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-full max-w-xs space-y-2">
              <Select value={selectedDeviceId || ''} onValueChange={setSelectedDeviceId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma câmera" /></SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Câmera ${devices.indexOf(device) + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleScan} disabled={isScanning} className="w-full">
                {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Analisar Rosto
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-center min-h-[300px] flex flex-col items-center justify-center">
          {!snapshot && <p className="text-muted-foreground">Aguardando análise...</p>}
          {isScanning && <Loader2 className="w-12 h-12 animate-spin text-primary" />}
          
          {snapshot && !isScanning && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in">
              <h3 className="font-semibold">Resultado da Análise:</h3>
              {matchResult === 'not_found' && <p className="text-lg font-bold text-destructive">Cliente não encontrado.</p>}
              {matchResult && matchResult !== 'not_found' && (
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={matchResult.avatar || undefined} />
                    <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
                  </Avatar>
                  <p className="text-2xl font-bold text-primary">{matchResult.name}</p>
                  <p className="text-sm text-muted-foreground">Confiança: {((1 - matchResult.distance) * 100).toFixed(2)}%</p>
                </div>
              )}
              <Button variant="outline" onClick={reset}><RefreshCw className="w-4 h-4 mr-2" />Analisar Novamente</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}