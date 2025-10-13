import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw } from 'lucide-react';
import { showError } from '@/utils/toast';

type FaceRegistrationProps = {
  onFaceRegistered: (imageUrl: string) => void;
  isSubmitting: boolean;
};

const videoConstraints = {
  width: 400,
  height: 400,
  facingMode: 'user',
};

export function FaceRegistration({ onFaceRegistered, isSubmitting }: FaceRegistrationProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
    }
  }, [webcamRef]);

  const resetCapture = () => {
    setCapturedImage(null);
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
    } catch (error: any) {
      showError(`Erro ao salvar a imagem: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
      <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center">
        {capturedImage ? (
          <img src={capturedImage} alt="Rosto capturado" className="w-full h-full object-cover" />
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
          />
        )}
      </div>
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
          <Button onClick={capture}>
            <Camera className="w-4 h-4 mr-2" /> Capturar Rosto
          </Button>
        )}
      </div>
    </div>
  );
}