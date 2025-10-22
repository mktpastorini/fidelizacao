import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Camera, Search, User, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useSettings } from '@/contexts/SettingsContext';

export function RecognitionTester() {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isHookLoading, error, recognize } = useFaceRecognition();
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [matchResult, setMatchResult] = useState<{ name: string; distance: number; avatar: string | null } | 'not_found' | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [useFallbackConstraints, setUseFallbackConstraints] = useState(false); // Novo estado para fallback

  useEffect(() => {
    const getDevices = async () => {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
      setDevices(videoDevices);

      const savedCameraId = settings?.preferred_camera_device_id;
      const isSavedCameraAvailable = videoDevices.some(device => device.deviceId === savedCameraId);

      if (savedCameraId && isSavedCameraAvailable) {
        setSelectedDeviceId(savedCameraId);
      } else if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    };
    getDevices();
  }, [settings]);

  const videoConstraints = useMemo(() => {
    if (useFallbackConstraints || !selectedDeviceId) {
      // Restrições padrão (qualquer câmera)
      return { width: 400, height: 400 };
    }
    // Restrições específicas (câmera preferida)
    return {
      width: 400,
      height: 400,
      deviceId: { exact: selectedDeviceId },
    };
  }, [selectedDeviceId, useFallbackConstraints]);

  const handleMediaError = useCallback((err: any) => {
    console.error("Erro ao acessar a câmera no RecognitionTester:", err);
    
    if (err.name === 'OverconstrainedError' && !useFallbackConstraints) {
      console.warn("OverconstrainedError detectado. Tentando fallback de câmera.");
      setUseFallbackConstraints(true);
      return;
    }
    
    // Se for outro erro ou se o fallback falhar, exibe o erro
    // Note: O erro de permissão é geralmente tratado no CameraSettings, mas mantemos aqui por segurança.
    // Não definimos um erro global aqui para não sobrescrever o erro do hook de reconhecimento.
  }, [useFallbackConstraints]);

  const handleScan = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setSnapshot(imageSrc);
    setIsScanning(true);
    setMatchResult(null);

    const result = await recognize(imageSrc);
    
    if (result && result.client) {
      setMatchResult({
        name: result.client.nome,
        distance: result.distance,
        avatar: result.client.avatar_url || null,
      });
    } else {
      setMatchResult('not_found');
    }
    setIsScanning(false);
  }, [recognize]);

  const reset = () => {
    setSnapshot(null);
    setMatchResult(null);
    setUseFallbackConstraints(false); // Resetar fallback
  };

  if (error) {
    return <Alert variant="destructive"><AlertTitle>Erro Crítico</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }

  if (isHookLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin mr-2" /> Carregando modelos de reconhecimento...</div>;
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
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover"
                onUserMediaError={handleMediaError}
              />
            </div>
            <div className="w-full max-w-xs space-y-2">
              <Select value={selectedDeviceId || ''} onValueChange={(value) => { setSelectedDeviceId(value); setUseFallbackConstraints(false); }}>
                <SelectTrigger><SelectValue placeholder="Selecione uma câmera" /></SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>{device.label || `Câmera ${devices.indexOf(device) + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleScan} disabled={isScanning || !isReady} className="w-full">
                {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Analisar Rosto
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 text-center min-h-[300px] flex flex-col items-center justify-center">
          {!snapshot && !isScanning && <p className="text-muted-foreground">Aguardando análise...</p>}
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