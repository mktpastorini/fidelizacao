import { useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';

// Usando um CDN confiável para os modelos
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

type CustomerFace = {
  cliente_id: string;
  embedding: number[];
  cliente: Cliente | null;
};

export function useFaceRecognition() {
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isInitializingMatcher, setIsInitializingMatcher] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Cliente[]>([]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setError(null);
        setIsLoadingModels(true);
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
      } catch (e) {
        console.error("Erro ao carregar modelos de IA:", e);
        setError('Falha crítica ao carregar os modelos de IA. Verifique a conexão com a internet.');
      } finally {
        setIsLoadingModels(false);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (isLoadingModels) return;

    const initFaceMatcher = async () => {
      try {
        setError(null);
        setIsInitializingMatcher(true);
        const { data: faces, error: dbError } = await supabase
          .from('customer_faces')
          .select('cliente_id, embedding, cliente:clientes!inner(*)');

        if (dbError) throw dbError;

        const typedFaces = faces as CustomerFace[];
        const validClients = Array.from(new Map(typedFaces.map(f => f.cliente).filter(Boolean).map(c => [c!.id, c])).values()) as Cliente[];
        setClients(validClients);

        if (typedFaces.length === 0) {
          return;
        }

        const labeledDescriptors = typedFaces
          .filter(face => face.embedding && face.cliente_id)
          .map(face => new faceapi.LabeledFaceDescriptors(face.cliente_id, [new Float32Array(face.embedding)]));

        if (labeledDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.5));
        }
      } catch (e: any) {
        console.error("Erro ao inicializar o Face Matcher:", e);
        setError('Falha ao carregar os rostos cadastrados no banco de dados.');
      } finally {
        setIsInitializingMatcher(false);
      }
    };

    initFaceMatcher();
  }, [isLoadingModels]);

  const recognize = useCallback(async (image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
    if (isLoadingModels || isInitializingMatcher || !faceMatcher) {
      return null;
    }

    const detection = await faceapi
      .detectSingleFace(image)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return null;
    }

    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
    return bestMatch;
  }, [isLoadingModels, isInitializingMatcher, faceMatcher]);

  const getClientById = (id: string) => {
    return clients.find(c => c.id === id) || null;
  }

  const isReady = !isLoadingModels && !isInitializingMatcher;

  return { isReady, isLoading: isLoadingModels || isInitializingMatcher, error, recognize, getClientById };
}