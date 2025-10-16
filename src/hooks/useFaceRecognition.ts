import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';
import { useToast } from "@/components/ui/use-toast";

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export function useFaceRecognition() {
  const { toast } = useToast();
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedClient, setRecognizedClient] = useState<Cliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        setIsModelsLoaded(true);
      } catch (e) {
        console.error("Erro ao carregar modelos de IA:", e);
        setError("Falha ao carregar os modelos de IA. Verifique a conexão e recarregue a página.");
      }
    }
    loadModels();

    return () => {
      if (recognitionInterval.current) {
        clearInterval(recognitionInterval.current);
      }
    };
  }, []);

  const startRecognition = useCallback((videoElement: HTMLVideoElement) => {
    if (!isModelsLoaded || recognitionInterval.current) return;

    recognitionInterval.current = setInterval(async () => {
      if (videoElement.readyState < 3 || isRecognizing) return;

      const canvas = faceapi.createCanvasFromMedia(videoElement);
      const displaySize = { width: videoElement.videoWidth, height: videoElement.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
      
      if (detections.length > 0 && !isRecognizing) {
        setIsRecognizing(true);
        setRecognizedClient(null);

        // Captura o frame como uma imagem base64
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoElement.videoWidth;
        tempCanvas.height = videoElement.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx?.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageUrl = tempCanvas.toDataURL('image/jpeg');

        try {
          const { data, error: functionError } = await supabase.functions.invoke('recognize-face', {
            body: { image_url: imageUrl },
          });

          if (functionError) throw functionError;

          if (data.match) {
            setRecognizedClient(data.match);
            toast({
              title: "Cliente Reconhecido!",
              description: `Bem-vindo(a) de volta, ${data.match.nome}!`,
            });
            stopRecognition();
          } else {
             // Se não encontrou, espera um pouco antes de tentar de novo para não sobrecarregar
            setTimeout(() => setIsRecognizing(false), 2000);
          }
        } catch (err) {
          console.error("Erro ao invocar a função de reconhecimento:", err);
          toast({
            title: "Erro no Reconhecimento",
            description: "Não foi possível se comunicar com o serviço de reconhecimento.",
            variant: "destructive",
          });
          // Libera para tentar novamente após um erro
          setTimeout(() => setIsRecognizing(false), 5000);
        }
      }
    }, 1500); // Tenta reconhecer a cada 1.5 segundos
  }, [isModelsLoaded, isRecognizing, toast]);

  const stopRecognition = useCallback(() => {
    if (recognitionInterval.current) {
      clearInterval(recognitionInterval.current);
      recognitionInterval.current = null;
    }
    setIsRecognizing(false);
  }, []);

  const resetRecognition = useCallback(() => {
    stopRecognition();
    setRecognizedClient(null);
    setError(null);
  }, [stopRecognition]);

  return {
    isModelsLoaded,
    isRecognizing,
    recognizedClient,
    error,
    startRecognition,
    stopRecognition,
    resetRecognition,
  };
}