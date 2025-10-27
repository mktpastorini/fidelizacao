import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useMultiFaceRecognition, FaceMatch } from '@/hooks/useMultiFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Cliente } from '@/types/supabase';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Video, VideoOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ExitCameraProps = {
  onDebtorDetected: (cliente: Cliente) => void;
  isPaused: boolean;
};

export function ExitCamera({ onDebtorDetected, isPaused }: ExitCameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isLoading: isRecognitionLoading, error: recognitionError, recognizeMultiple } = useMultiFaceRecognition();
  
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Monitorando a saída...");

  const SCAN_INTERVAL_MS = settings?.multi_detection_interval || 2000;
  const minConfidence = settings?.multi_detection_confidence || 0.90; // Mantém um padrão mais alto para segurança

  const videoConstraints = {
    width: 1280,
    height: 720,
    deviceId: settings?.preferred_camera_device_id || undefined,
  };

  const scanForDebtors = useCallback(async () => {
    if (!isCameraOn || !webcamRef.current || isRecognitionLoading || !isCameraReady) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setStatusMessage("Analisando...");
    const matches = await recognizeMultiple(imageSrc, minConfidence);

    if (matches.length > 0) {
      setStatusMessage(`${matches.length} rosto(s) detectado(s). Verificando status...`);
      for (const match of matches) {
        const { data, error } = await supabase.functions.invoke('check-customer-status', {
          body: { cliente_id: match.client.id },
        });

        if (error) {
          console.error("Erro ao verificar status do cliente:", error);
          continue;
        }

        if (data.hasOpenOrder) {
          onDebtorDetected(match.client);
        }
      }
    } else {
      setStatusMessage("Monitorando a saída...");
    }
  }, [isCameraOn, isRecognitionLoading, isCameraReady, recognizeMultiple, onDebtorDetected, minConfidence]);

  useEffect(() => {
    if (isPaused || !isCameraOn || !isCameraReady || isRecognitionLoading) {
      return;
    }

    const intervalId = setInterval(scanForDebtors, SCAN_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isPaused, isCameraOn, isCameraReady, isRecognitionLoading, scanForDebtors, SCAN_INTERVAL_MS]);

  const handleMediaError = (err: any) => {
    let errorMessage = `Erro de mídia: ${err.message}`;
    if (err.name === 'NotAllowedError') errorMessage = "Acesso à câmera negado.";
    setMediaError(errorMessage);
    setIsCameraOn(false);
  };

  const displayError = recognitionError || mediaError;

  const renderStatus = () => {
    if (isPaused) {
      return <p className="font-semibold text-yellow-500">Pausado - Alerta na tela</p>;
    }
    if (isRecognitionLoading) {
      return (
        <div className="flex items-center text-sm"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {statusMessage}</div>
      );
    }
    return <p className="text-muted-foreground">{isCameraOn ? statusMessage : "Câmera pausada"}</p>;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Câmera de Saída
          <Button variant="ghost" size="icon" onClick={() => setIsCameraOn(prev => !prev)} disabled={!!mediaError}>
            {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
        </CardTitle>
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
        <div className="w-full h-10 flex items-center justify-center">
          {renderStatus()}
        </div>
      </CardContent>
    </Card>
  );
}