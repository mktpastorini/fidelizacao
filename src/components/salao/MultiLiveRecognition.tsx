"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { Camera, Video, VideoOff, Users, AlertCircle, Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { v4 as uuidv4 } from 'uuid';

const MultiLiveRecognition = () => {
  const [availableDevices, setAvailableDevices] = useState([]);
  const [cameraInstances, setCameraInstances] = useState([]);
  const videoRefs = useRef({});
  const detectionIntervals = useRef({});
  const [detectionBoxes, setDetectionBoxes] = useState({});
  const [settings, setSettings] = useState({
    multi_detection_interval: 2000,
    multi_detection_confidence: 0.85,
  });
  const [isDetecting, setIsDetecting] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('user_settings')
        .select('multi_detection_interval, multi_detection_confidence')
        .eq('id', user.id)
        .single();
      if (data) {
        setSettings(prev => ({ ...prev, ...data }));
      }
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        if (videoDevices.length > 0 && cameraInstances.length === 0) {
          setCameraInstances([{ id: uuidv4(), deviceId: videoDevices[0].deviceId, isCameraOn: false, stream: null, mediaError: null }]);
        }
      } catch (err) {
        console.error("Erro ao acessar dispositivos de mídia:", err);
        toast.error("Não foi possível acessar as câmeras. Verifique as permissões do navegador.");
      }
    };
    getDevices();
  }, [fetchSettings, cameraInstances.length]);

  const updateCameraInstance = (id, updates) => {
    setCameraInstances(prev => prev.map(cam => cam.id === id ? { ...cam, ...updates } : cam));
  };

  const startStream = useCallback(async (cam) => {
    if (cam.stream) {
      cam.stream.getTracks().forEach(track => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } }
      });
      updateCameraInstance(cam.id, { stream, mediaError: null });
    } catch (err) {
      console.error(`Erro ao iniciar a câmera ${cam.deviceId}:`, err);
      let errorMessage = "Erro ao iniciar a câmera.";
      if (err.name === "NotAllowedError") {
        errorMessage = "Permissão para câmera negada.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage = "Câmera não encontrada.";
      } else if (err.name === "NotReadableError") {
        errorMessage = "A câmera já está em uso por outra aplicação.";
      }
      updateCameraInstance(cam.id, { isCameraOn: false, mediaError: errorMessage });
      toast.error(errorMessage, { id: `cam-error-${cam.id}` });
    }
  }, []);

  const stopStream = useCallback((cam) => {
    if (cam.stream) {
      cam.stream.getTracks().forEach(track => track.stop());
      updateCameraInstance(cam.id, { stream: null });
    }
    if (detectionIntervals.current[cam.id]) {
      clearInterval(detectionIntervals.current[cam.id]);
      delete detectionIntervals.current[cam.id];
    }
  }, []);

  useEffect(() => {
    cameraInstances.forEach(cam => {
      if (cam.isCameraOn && !cam.stream) {
        startStream(cam);
      } else if (!cam.isCameraOn && cam.stream) {
        stopStream(cam);
      }
    });
  }, [cameraInstances, startStream, stopStream]);

  const captureAndDetect = useCallback(async (camId) => {
    const video = videoRefs.current[camId];
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const { data, error } = await supabase.functions.invoke('compreface-search', {
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' }
      });

      if (error) {
        console.error('Erro na detecção:', error);
        return;
      }
      
      if (data && data.results) {
        const validDetections = data.results
          .filter(result => result.subjects && result.subjects.length > 0 && result.subjects[0].similarity >= settings.multi_detection_confidence)
          .map(result => ({
            ...result.box,
            cliente_nome: result.subjects[0].subject,
            similarity: result.subjects[0].similarity,
          }));
        
        setDetectionBoxes(prev => ({ ...prev, [camId]: validDetections }));
      } else {
        setDetectionBoxes(prev => ({ ...prev, [camId]: [] }));
      }
    }, 'image/jpeg');
  }, [settings.multi_detection_confidence]);

  useEffect(() => {
    cameraInstances.forEach(cam => {
      if (cam.isCameraOn && cam.stream && isDetecting) {
        if (!detectionIntervals.current[cam.id]) {
          detectionIntervals.current[cam.id] = setInterval(() => {
            captureAndDetect(cam.id);
          }, settings.multi_detection_interval);
        }
      } else {
        if (detectionIntervals.current[cam.id]) {
          clearInterval(detectionIntervals.current[cam.id]);
          delete detectionIntervals.current[cam.id];
        }
      }
    });

    return () => {
      Object.values(detectionIntervals.current).forEach(clearInterval);
    };
  }, [cameraInstances, isDetecting, settings.multi_detection_interval, captureAndDetect]);

  const handleDeviceChange = (id, deviceId) => {
    updateCameraInstance(id, { deviceId });
  };

  const addCamera = () => {
    if (availableDevices.length > 0) {
      const newDeviceId = availableDevices.find(d => !cameraInstances.some(c => c.deviceId === d.deviceId))?.deviceId || availableDevices[0].deviceId;
      setCameraInstances(prev => [...prev, { id: uuidv4(), deviceId: newDeviceId, isCameraOn: false, stream: null, mediaError: null }]);
    }
  };

  const removeCamera = (id) => {
    const camToRemove = cameraInstances.find(c => c.id === id);
    if (camToRemove) stopStream(camToRemove);
    setCameraInstances(prev => prev.filter(cam => cam.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center"><Camera className="mr-2" />Reconhecimento em Múltiplas Câmeras</CardTitle>
            <CardDescription>Monitore diversas fontes de vídeo simultaneamente.</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="icon" variant="outline" onClick={addCamera} disabled={cameraInstances.length >= availableDevices.length}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={() => removeCamera(cameraInstances[cameraInstances.length - 1]?.id)} disabled={cameraInstances.length <= 1}>
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cameraInstances.map((cam) => (
            <div key={cam.id} className="relative aspect-video bg-gray-900 rounded-lg flex items-center justify-center text-white overflow-hidden border border-gray-700">
              {cam.isCameraOn && cam.stream ? (
                <>
                  <video
                    ref={el => {
                      if (el) {
                        videoRefs.current[cam.id] = el;
                        if (el.srcObject !== cam.stream) {
                          el.srcObject = cam.stream;
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0">
                    {detectionBoxes[cam.id]?.map((box, index) => (
                      <div
                        key={index}
                        className="absolute border-2 rounded-md transition-all duration-200"
                        style={{
                          left: `${box.x_min * 100}%`,
                          top: `${box.y_min * 100}%`,
                          width: `${(box.x_max - box.x_min) * 100}%`,
                          height: `${(box.y_max - box.y_min) * 100}%`,
                          borderColor: box.similarity > 0.95 ? '#2ecc71' : box.similarity > 0.85 ? '#f1c40f' : '#e74c3c',
                          boxShadow: `0 0 10px ${box.similarity > 0.95 ? '#2ecc71' : box.similarity > 0.85 ? '#f1c40f' : '#e74c3c'}`,
                        }}
                      >
                        <div className="absolute -top-7 left-0 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          {box.cliente_nome} ({(box.similarity * 100).toFixed(1)}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 z-20"
                    onClick={() => updateCameraInstance(cam.id, { isCameraOn: false })}
                  >
                    <VideoOff className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center p-4">
                    <VideoOff className="h-12 w-12 mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-400">
                      {cam.isCameraOn ? (cam.mediaError || "Câmera indisponível") : "Câmera desligada"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 z-20 text-white hover:bg-white/20"
                    onClick={() => updateCameraInstance(cam.id, { isCameraOn: true, mediaError: null })}
                  >
                    <Video className="h-5 w-5" />
                  </Button>
                </>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent z-10">
                <Select
                  value={cam.deviceId}
                  onValueChange={(value) => handleDeviceChange(cam.id, value)}
                  disabled={cam.isCameraOn}
                >
                  <SelectTrigger className="w-full bg-gray-800/80 border-gray-600 text-white">
                    <SelectValue placeholder="Selecione a câmera" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDevices.map((device, index) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Câmera ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="detection-switch" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Ativar Detecção</span>
            </Label>
            <Switch
              id="detection-switch"
              checked={isDetecting}
              onCheckedChange={setIsDetecting}
            />
          </div>
          <div className="space-y-2">
            <Label>Intervalo de Detecção: {settings.multi_detection_interval}ms</Label>
            <Slider
              min={500}
              max={10000}
              step={100}
              value={[settings.multi_detection_interval]}
              onValueChange={(value) => setSettings(s => ({ ...s, multi_detection_interval: value[0] }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Confiança Mínima: {(settings.multi_detection_confidence * 100).toFixed(0)}%</Label>
            <Slider
              min={0.5}
              max={1}
              step={0.01}
              value={[settings.multi_detection_confidence]}
              onValueChange={(value) => setSettings(s => ({ ...s, multi_detection_confidence: value[0] }))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiLiveRecognition;