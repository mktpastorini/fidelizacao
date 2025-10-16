import { useState, useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError } from '@/utils/toast';

type CameraSettingsProps = {
  onSave: (settings: { preferred_camera_device_id: string }) => void;
};

export function CameraSettings({ onSave }: CameraSettingsProps) {
  const { settings } = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        showError("Não foi possível listar os dispositivos de câmera.");
        console.error(err);
      }
    };
    getDevices();
  }, []);

  if (devices.length <= 1) {
    return <p className="text-sm text-muted-foreground">Nenhuma câmera adicional detectada.</p>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="camera-select">Câmera Padrão</Label>
      <Select
        value={settings?.preferred_camera_device_id || ''}
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