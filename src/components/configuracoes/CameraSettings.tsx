import { useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError } from '@/utils/toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { VideoOff } from 'lucide-react';

type CameraSettingsProps = {
  onSave: (settings: { preferred_camera_device_id: string }) => void;
};

export function CameraSettings({ onSave }: CameraSettingsProps) {
  const { settings } = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      setCameraError(null);
      try {
        // Tenta obter permissão primeiro (necessário em alguns navegadores para listar)
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
        setDevices(videoDevices);

        const savedCameraId = settings?.preferred_camera_device_id;
        const isSavedCameraAvailable = videoDevices.some(device => device.deviceId === savedCameraId);

        if (savedCameraId && isSavedCameraAvailable) {
          // Mantém o ID salvo se estiver disponível
        } else if (videoDevices.length > 0) {
          // Seleciona o primeiro se não houver preferência salva ou se a preferência não estiver disponível
          onSave({ preferred_camera_device_id: videoDevices[0].deviceId });
        }
      } catch (err: any) {
        console.error("Erro ao listar dispositivos de câmera:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError("Acesso à câmera negado. Por favor, permita o acesso nas configurações do seu navegador.");
        } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          setCameraError("Acesso à câmera bloqueado. O sistema deve ser acessado via HTTPS.");
        } else {
          setCameraError(`Erro desconhecido ao acessar a câmera: ${err.message}`);
        }
        setDevices([]);
      }
    };
    getDevices();
  }, [settings, onSave]);

  if (cameraError) {
    return (
      <Alert variant="destructive">
        <VideoOff className="h-4 w-4" />
        <AlertTitle>Falha ao Acessar a Câmera</AlertTitle>
        <AlertDescription>{cameraError}</AlertDescription>
      </Alert>
    );
  }

  if (devices.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma câmera detectada. Verifique se o dispositivo está conectado e se o acesso via HTTPS está ativo.</p>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="camera-select">Câmera Padrão</Label>
      <Select
        value={settings?.preferred_camera_device_id || devices[0]?.deviceId || ''}
        onValueChange={(value) => onSave({ preferred_camera_device_id: value })}
      >
        <SelectTrigger id="camera-select">
          <SelectValue placeholder="Selecione sua câmera preferida" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `Câmera ${devices.indexOf(device) + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}