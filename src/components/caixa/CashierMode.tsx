import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Cliente } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Video, VideoOff, Camera } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { PaymentModal } from './PaymentModal';

type CashierModeProps = {};

const SCAN_INTERVAL_MS = 2000;

export function CashierMode({}: CashierModeProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isScanning, error, recognize } = useFaceRecognition();
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [lastStatusMessage, setLastStatusMessage] = useState("Aguardando cliente para pagamento...");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [foundClient, setFoundClient] = useState<Cliente | null>(null);
  const [tableData, setTableData] = useState<any>(null);

  const videoConstraints = {
    width: 400,
    height: 400,
    deviceId: settings?.preferred_camera_device_id || undefined,
  };

  const handleRecognition = useCallback(async (manualTrigger = false) => {
    if (!isCameraOn || !webcamRef.current || isScanning) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    const result = await recognize(imageSrc);
    
    if (result?.status === 'MATCH_FOUND' && result.match) {
      setLastStatusMessage(`Cliente encontrado: ${result.match.nome}`);
      
      // Fetch table data for the recognized client
      const { data: tableDetails, error: rpcError } = await supabase.rpc('get_customer_table_details', { p_cliente_id: result.match.id });
      
      if (rpcError) {
        showError(`Erro ao buscar dados da mesa: ${rpcError.message}`);
        return;
      }

      if (tableDetails && tableDetails.length > 0) {
        setFoundClient(result.match);
        setTableData(tableDetails[0]);
        setIsModalOpen(true);
      } else {
        showError(`${result.match.nome} foi reconhecido, mas não está em nenhuma mesa com conta aberta.`);
      }
    } else if (result?.message) {
      setLastStatusMessage(result.message);
    }
  }, [isCameraOn, isScanning, recognize]);

  useEffect(() => {
    if (!isCameraOn || !isReady || !isCameraReady || isScanning || isModalOpen) {
        return;
    }

    const intervalId = setInterval(() => {
        handleRecognition(false);
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isCameraOn, isReady, isCameraReady, isScanning, isModalOpen, handleRecognition]);

  const handleMediaError = (err: any) => {
    console.error("[CashierMode] Erro ao acessar a câmera:", err);
    let errorMessage = `Erro de mídia: ${err.message}`;
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage = "Acesso à câmera negado. Verifique as permissões do navegador.";
    } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      errorMessage = "Acesso à câmera bloqueado. O sistema deve ser acessado via HTTPS.";
    }
    setMediaError(errorMessage);
    setIsCameraOn(false);
    setIsCameraReady(false);
  };

  const displayError = error || mediaError;

  const renderStatus = () => {
    if (isScanning) {
      return (
        <div className="text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p>Analisando...</p>
        </div>
      );
    }
    return <p className="text-muted-foreground">{isCameraOn ? lastStatusMessage : "Câmera pausada"}</p>;
  };

  return (
    <>
      <Card className="sticky top-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Modo Caixa</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsCameraOn(prev => !prev)} disabled={!!mediaError}>
            {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
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
          
          <div className="w-full h-24 flex items-center justify-center">
            {renderStatus()}
          </div>
          
          <Button 
            onClick={() => handleRecognition(true)} 
            disabled={!isCameraOn || isScanning || !!displayError || !isCameraReady}
            className="w-full"
          >
            {isScanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
            {isScanning ? "Analisando..." : "Identificar Cliente Agora"}
          </Button>
        </CardContent>
      </Card>
      <PaymentModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        cliente={foundClient}
        tableData={tableData}
      />
    </>
  );
}