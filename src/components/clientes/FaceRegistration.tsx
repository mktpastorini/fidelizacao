import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw } from 'lucide-react';
import { showError } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';

type FaceRegistrationProps = {
  onFaceRegistered: (imageUrl: string) => void;
  isSubmitting: boolean;
};

export function FaceRegistration({ onFaceRegistered, isSubmitting }: FaceRegistrationProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
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
        }
      } catch (err) {
        console.error(err);
        // Se o erro for de segurança (não HTTPS), o navegador não lista os dispositivos.
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          setCameraError("Acesso à câmera bloqueado. Certifique-se de que o sistema está sendo acessado via HTTPS.");
        } else {
          setCameraError("Não foi possível listar os dispositivos de câmera. Verifique as permissões.");
        }
      }
    };
    getDevices();
  }, [settings]);

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
    }
  }, [webcamRef]);

  const resetCapture = () => {
    setCapturedImage(null);
    setCameraError(null);
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  const handleSaveFace = async () => {
    if (!capturedImage) return;

    const file = dataURLtoFile(capturedImage, `face-${Date.now()}.jpg`);
    if (!file) {
      showError("Não foi possível converter a imagem capturada.");
      return;
    }

    try {
      const filePath = `faces/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('client_avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('client_avatars').getPublicUrl(filePath);
      if (!data.publicUrl) throw new Error("Não foi possível obter a URL pública da imagem.");

      onFaceRegistered(data.publicUrl);
      resetCapture(); // Reseta para permitir múltiplas capturas
    } catch (error: any) {
      showError(`Erro ao salvar a imagem: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
      <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center">
        {capturedImage ? (
          <img src={capturedImage} alt="Rosto capturado" className="w-full h-full object-cover" />
        ) : cameraError ? (
          <div className="text-center p-4 text-destructive">
            <p className="font-semibold">Erro de Câmera</p>
            <p className="text-sm">{cameraError}</p>
          </div>
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
            mirrored={true}
            onUserMediaError={(e) => {
              console.error("Erro ao acessar a câmera:", e);
              setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
            }}
          />
        )}
      </div>
      {!capturedImage && devices.length > 1 && !cameraError && (
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
      <div className="flex gap-2">
        {capturedImage ? (
          <>
            <Button onClick={resetCapture} variant="outline" disabled={isSubmitting}>
              <RefreshCw className="w-4 h-4 mr-2" /> Tentar Novamente
            </Button>
            <Button onClick={handleSaveFace} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar Rosto'}
            </Button>
          </>
        ) : (
          <Button onClick={capture} disabled={!!cameraError}>
            <Camera className="w-4 h-4 mr-2" /> Capturar Rosto
          </Button>
        )}
      </div>
    </div>
  );
}