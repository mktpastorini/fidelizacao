import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { useMultiFaceRecognition, FaceMatch } from '@/hooks/useMultiFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Video, VideoOff, Users, PlusCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type RecognizedClientDisplay = {
  client: FaceMatch['client'];
  timestamp: number;
};

type MultiLiveRecognitionProps = {
  onRecognizedFacesUpdate: (clients: RecognizedClientDisplay[]) => void;
  allocatedClientIds: string[];
};

const PERSISTENCE_DURATION_MS = 10000; // 10 segundos

interface CameraInstance {
  id: string;
  deviceId: string | null;
  isCameraOn: boolean;
  webcamRef: React.RefObject<Webcam>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  mediaError: string | null;
  recognizedFaces: FaceMatch[];
  isCameraReady: boolean;
}

export function MultiLiveRecognition({ onRecognizedFacesUpdate, allocatedClientIds }: MultiLiveRecognitionProps) {
  const { settings } = useSettings();
  const { isLoading: isRecognitionLoading, error: recognitionError, recognizeMultiple } = useMultiFaceRecognition();
  
  const [cameraInstances, setCameraInstances] = useState<CameraInstance[]>([]);
  const [allVideoDevices, setAllVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [persistentRecognizedClients, setPersistentRecognizedClients] = useState<RecognizedClientDisplay[]>([]);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scanInterval = settings?.multi_detection_interval || 2000;
  const minConfidence = settings?.multi_detection_confidence || 0.85;

  // --- Setup Inicial de Câmeras ---
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
        setAllVideoDevices(videoDevices);

        if (cameraInstances.length === 0 && videoDevices.length > 0) {
          addCameraInstance(videoDevices[0].deviceId);
        }
      } catch (err: any) {
        console.error("Erro ao listar dispositivos de câmera:", err);
        if (cameraInstances.length === 0) {
          setCameraInstances([{
            id: 'cam-1',
            deviceId: null,
            isCameraOn: false,
            webcamRef: React.createRef(),
            canvasRef: React.createRef(),
            mediaError: err.message,
            recognizedFaces: [],
            isCameraReady: false,
          }]);
        }
      }
    };
    getDevices();
  }, []);

  const addCameraInstance = (initialDeviceId: string | null = null) => {
    const newId = `cam-${Date.now()}`;
    setCameraInstances(prev => [
      ...prev,
      {
        id: newId,
        deviceId: initialDeviceId,
        isCameraOn: true,
        webcamRef: React.createRef(),
        canvasRef: React.createRef(),
        mediaError: null,
        recognizedFaces: [],
        isCameraReady: false,
      }
    ]);
  };

  const removeCameraInstance = (id: string) => {
    setCameraInstances(prev => prev.filter(cam => cam.id !== id));
  };

  const updateCameraInstance = useCallback((id: string, updates: Partial<CameraInstance>) => {
    setCameraInstances(prev => prev.map(cam => cam.id === id ? { ...cam, ...updates } : cam));
  }, []);

  // --- Lógica de Varredura Automática ---
  const scanAllCameras = useCallback(async () => {
    if (isRecognitionLoading) return;

    const activeCameras = cameraInstances.filter(cam => cam.isCameraOn && cam.isCameraReady && !cam.mediaError && cam.webcamRef.current);
    if (activeCameras.length === 0) return;

    const allResults: FaceMatch[] = [];
    for (const cam of activeCameras) {
      const imageSrc = cam.webcamRef.current?.getScreenshot();
      if (imageSrc) {
        const results = await recognizeMultiple(imageSrc, minConfidence);
        updateCameraInstance(cam.id, { recognizedFaces: results });
        allResults.push(...results);
      }
    }

    const allocatedSet = new Set(allocatedClientIds);
    setPersistentRecognizedClients(prevClients => {
      const now = Date.now();
      const updatedClients = [...prevClients];
      
      allResults.forEach(match => {
        if (!allocatedSet.has(match.client.id)) {
          const existingIndex = updatedClients.findIndex(c => c.client.id === match.client.id);
          if (existingIndex !== -1) {
            updatedClients[existingIndex].timestamp = now;
          } else {
            updatedClients.push({ client: match.client, timestamp: now });
          }
        }
      });
      return updatedClients.filter(c => (now - c.timestamp) < PERSISTENCE_DURATION_MS && !allocatedSet.has(c.client.id));
    });

  }, [cameraInstances, isRecognitionLoading, recognizeMultiple, minConfidence, updateCameraInstance, allocatedClientIds]);

  useEffect(() => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

    const loop = () => {
      scanAllCameras();
      scanTimeoutRef.current = setTimeout(loop, scanInterval);
    };

    scanTimeoutRef.current = setTimeout(loop, scanInterval);

    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [scanAllCameras, scanInterval]);

  // --- Sincronização e Limpeza de Clientes Persistentes ---
  useEffect(() => {
    onRecognizedFacesUpdate(persistentRecognizedClients);
  }, [persistentRecognizedClients, onRecognizedFacesUpdate]);

  const getAvailableDevices = useCallback((currentDeviceId: string | null) => {
    const usedDeviceIds = new Set(cameraInstances.map(c => c.deviceId).filter(Boolean));
    return allVideoDevices.filter(device => 
      device.deviceId === currentDeviceId || !usedDeviceIds.has(device.deviceId)
    );
  }, [allVideoDevices, cameraInstances]);

  const displayError = recognitionError;

  return (
    <Card className="sticky top-6 h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col gap-4 p-4 pt-0 min-h-0">
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => addCameraInstance()} 
            disabled={allVideoDevices.length === 0 || cameraInstances.length >= allVideoDevices.length}
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Adicionar Câmera
          </Button>
        </div>

        {displayError && <Alert variant="destructive"><AlertTitle>Erro Global</AlertTitle><AlertDescription>{displayError}</AlertDescription></Alert>}
        
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 gap-4 pr-2">
            {cameraInstances.length === 0 && allVideoDevices.length > 0 && (
              <div className="text-center text-muted-foreground p-4">
                <p>Clique em "Adicionar Câmera" para começar.</p>
              </div>
            )}
            {cameraInstances.map((cam) => (
              <div key={cam.id} className="relative w-full aspect-video rounded-lg overflow-hidden border bg-secondary flex items-center justify-center">
                {cam.isCameraOn && !cam.mediaError ? (
                  <>
                    <Webcam
                      audio={false}
                      ref={cam.webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ deviceId: cam.deviceId ? { exact: cam.deviceId } : undefined, width: 1280, height: 720 }}
                      className="w-full h-full object-cover"
                      mirrored={true}
                      onUserMedia={() => updateCameraInstance(cam.id, { isCameraReady: true })}
                      onUserMediaError={(err) => updateCameraInstance(cam.id, { mediaError: (err as Error).message, isCameraOn: false, isCameraReady: false })}
                    />
                    <canvas ref={cam.canvasRef} className="absolute top-0 left-0 w-full h-full transform scaleX(-1)" />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => updateCameraInstance(cam.id, { isCameraOn: !cam.isCameraOn })} 
                      disabled={!!cam.mediaError}
                      className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    >
                      {cam.isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground p-4">
                    <VideoOff className="w-12 h-12 mb-2" />
                    <p>{cam.isCameraOn ? (cam.mediaError || "Câmera indisponível") : "Câmera desligada"}</p>
                    <Button 
                      size="sm" 
                      className="mt-2" 
                      onClick={() => updateCameraInstance(cam.id, { isCameraOn: true, mediaError: null })}
                      disabled={!cam.deviceId}
                    >
                      Ligar Câmera
                    </Button>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 bg-black/50 p-2 rounded-md">
                  <Select 
                    value={cam.deviceId || ''} 
                    onValueChange={(value) => updateCameraInstance(cam.id, { deviceId: value, isCameraOn: true, mediaError: null })}
                  >
                    <SelectTrigger className="w-full bg-white/10 text-white border-none">
                      <SelectValue placeholder="Selecione uma câmera" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableDevices(cam.deviceId).map((device) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          {device.label || `Câmera ${allVideoDevices.indexOf(device) + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {cameraInstances.length > 1 && (
                    <Button variant="destructive" size="icon" onClick={() => removeCameraInstance(cam.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
        
        <div className="w-full h-24 flex items-center justify-center shrink-0">
          {isRecognitionLoading ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
              <p>Analisando múltiplos rostos...</p>
            </div>
          ) : persistentRecognizedClients.length > 0 ? (
            <div className="text-center space-y-2 animate-in fade-in">
              <p className="text-sm text-muted-foreground">Rostos detectados:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {persistentRecognizedClients.map(face => (
                  <Badge key={face.client.id} className="flex items-center gap-1 bg-primary text-primary-foreground">
                    <Users className="w-3 h-3" /> {face.client.nome}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Aguardando clientes para multi-detecção...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}