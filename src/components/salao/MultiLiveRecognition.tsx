import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

type RecognizedClientDisplay = {
  client: FaceMatch['client'];
  timestamp: number;
};

type MultiLiveRecognitionProps = {
  onRecognizedFacesUpdate: (clients: RecognizedClientDisplay[]) => void;
  allocatedClientIds: string[];
};

const PERSISTENCE_DURATION_MS = 30 * 1000; // 30 segundos

interface CameraInstance {
  id: string; // Unique ID for this camera instance
  deviceId: string | null; // Selected camera device ID
  isCameraOn: boolean; // Is this camera feed active?
  webcamRef: React.RefObject<Webcam>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  mediaError: string | null;
  recognizedFaces: FaceMatch[]; // Faces detected by this specific camera
  lastRecognitionTime: number;
}

export function MultiLiveRecognition({ onRecognizedFacesUpdate, allocatedClientIds }: MultiLiveRecognitionProps) {
  const { settings } = useSettings();
  const { isLoading: isRecognitionLoading, error: recognitionError, recognizeMultiple } = useMultiFaceRecognition();
  
  const [cameraInstances, setCameraInstances] = useState<CameraInstance[]>([]);
  const [allVideoDevices, setAllVideoDevices] = useState<MediaDeviceInfo[]>([]);

  // Fetch all video devices once
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request media access to ensure all devices are listed
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
        setAllVideoDevices(videoDevices);

        // Add initial camera if none exist
        if (cameraInstances.length === 0 && videoDevices.length > 0) {
          addCameraInstance(videoDevices[0].deviceId);
        }
      } catch (err: any) {
        console.error("Erro ao listar dispositivos de câmera:", err);
        // Set error on the first camera instance if it exists, or globally if no cameras
        setCameraInstances(prev => {
          if (prev.length > 0) {
            return prev.map((inst, idx) => idx === 0 ? { ...inst, mediaError: err.message } : inst);
          }
          return [{
            id: 'cam-1',
            deviceId: null,
            isCameraOn: false,
            webcamRef: React.createRef(),
            canvasRef: React.createRef(),
            mediaError: err.message,
            recognizedFaces: [],
            lastRecognitionTime: 0,
          }];
        });
      }
    };
    getDevices();
  }, []); // Run only once on mount

  // Add a new camera instance
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
        lastRecognitionTime: 0,
      }
    ]);
  };

  // Remove a camera instance
  const removeCameraInstance = (id: string) => {
    setCameraInstances(prev => prev.filter(cam => cam.id !== id));
  };

  // Update a specific camera instance's state
  const updateCameraInstance = useCallback((id: string, updates: Partial<CameraInstance>) => {
    setCameraInstances(prev => prev.map(cam => cam.id === id ? { ...cam, ...updates } : cam));
  }, []);

  // Consolidated list of all recognized clients from all active cameras
  const [persistentRecognizedClients, setPersistentRecognizedClients] = useState<RecognizedClientDisplay[]>([]);

  // Effect to manage recognition intervals for each camera
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = [];
    const cleanupIntervals: NodeJS.Timeout[] = [];

    cameraInstances.forEach(cam => {
      if (cam.isCameraOn && cam.deviceId && !cam.mediaError) {
        const recognitionInterval = setInterval(async () => {
          if (isRecognitionLoading || !cam.webcamRef.current || !cam.canvasRef.current) return;

          const now = Date.now();
          if (now - cam.lastRecognitionTime < 3000) return; // Scan a cada 3 segundos

          updateCameraInstance(cam.id, { lastRecognitionTime: now });
          const imageSrc = cam.webcamRef.current.getScreenshot();
          if (!imageSrc) return;

          const video = cam.webcamRef.current.video;
          if (!video) return;

          const canvas = cam.canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const results = await recognizeMultiple(imageSrc);
          updateCameraInstance(cam.id, { recognizedFaces: results });

          // Update global persistent list
          setPersistentRecognizedClients(prevClients => {
            const updatedClients = [...prevClients];
            const currentClientIds = new Set(prevClients.map(c => c.client.id));
            const allocatedSet = new Set(allocatedClientIds);

            results.forEach(match => {
              if (!allocatedSet.has(match.client.id)) {
                if (currentClientIds.has(match.client.id)) {
                  const index = updatedClients.findIndex(c => c.client.id === match.client.id);
                  if (index !== -1) {
                    updatedClients[index].timestamp = now;
                  }
                } else {
                  updatedClients.push({ client: match.client, timestamp: now });
                }
              }
            });
            return updatedClients.filter(c => !allocatedSet.has(c.client.id));
          });
        }, 1000); // Check every 1 second
        intervals.push(recognitionInterval);

        const cleanupInterval = setInterval(() => {
          setPersistentRecognizedClients(prevClients => {
            const now = Date.now();
            const allocatedSet = new Set(allocatedClientIds);
            return prevClients.filter(c => (now - c.timestamp) < PERSISTENCE_DURATION_MS && !allocatedSet.has(c.client.id));
          });
        }, 5000); // Clean up every 5 seconds
        cleanupIntervals.push(cleanupInterval);
      }
    });

    return () => {
      intervals.forEach(clearInterval);
      cleanupIntervals.forEach(clearInterval);
    };
  }, [cameraInstances, isRecognitionLoading, recognizeMultiple, updateCameraInstance, allocatedClientIds]);

  // Notify parent component about recognized clients
  useEffect(() => {
    onRecognizedFacesUpdate(persistentRecognizedClients);
  }, [persistentRecognizedClients, onRecognizedFacesUpdate]);

  // Filter available devices for each select dropdown
  const getAvailableDevices = useCallback((currentDeviceId: string | null) => {
    const usedDeviceIds = new Set(cameraInstances.map(c => c.deviceId).filter(Boolean));
    return allVideoDevices.filter(device => 
      device.deviceId === currentDeviceId || !usedDeviceIds.has(device.deviceId)
    );
  }, [allVideoDevices, cameraInstances]);

  const displayError = recognitionError; // Global recognition error

  return (
    <Card className="sticky top-6 h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col gap-4 p-4 pt-0">
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
        
        <div className="grid grid-cols-1 gap-4 overflow-y-auto flex-1 pr-2">
          {cameraInstances.length === 0 && allVideoDevices.length > 0 && (
            <div className="text-center text-muted-foreground p-4">
              <p>Clique em "Adicionar Câmera" para começar.</p>
            </div>
          )}
          {cameraInstances.map((cam, index) => (
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
                    onUserMediaError={(err) => updateCameraInstance(cam.id, { mediaError: err.message, isCameraOn: false })}
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
        
        <div className="w-full h-24 flex items-center justify-center shrink-0">
          {isRecognitionLoading ? (
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
            <p className="text-muted-foreground">Aguardando clientes para multi-detecção...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}