import { useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';

const MODELS_URL = '/models';

type CustomerFace = {
  cliente_id: string;
  embedding: number[];
  cliente: Cliente | null;
};

export function useFaceRecognition() {
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Cliente[]>([]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        setIsModelsLoaded(true);
      } catch (e) {
        setError('Falha ao carregar os modelos de IA.');
        console.error(e);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!isModelsLoaded) return;

    const initFaceMatcher = async () => {
      try {
        const { data: faces, error: dbError } = await supabase
          .from('customer_faces')
          .select('cliente_id, embedding, cliente:clientes!inner(*)');

        if (dbError) throw dbError;

        const typedFaces = faces as CustomerFace[];
        const validClients = typedFaces.map(f => f.cliente).filter(Boolean) as Cliente[];
        setClients(validClients);

        if (typedFaces.length === 0) {
          setIsReady(true);
          return;
        }

        const labeledDescriptors = typedFaces
          .filter(face => face.embedding && face.cliente_id)
          .map(face => new faceapi.LabeledFaceDescriptors(
            face.cliente_id,
            [new Float32Array(face.embedding)]
          ));

        if (labeledDescriptors.length > 0) {
          setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.5));
        }
        setIsReady(true);
      } catch (e: any) {
        setError('Falha ao carregar os rostos cadastrados.');
        console.error(e);
      }
    };

    initFaceMatcher();
  }, [isModelsLoaded]);

  const recognize = useCallback(async (image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
    if (!isReady || !faceMatcher) {
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
  }, [isReady, faceMatcher]);

  const getClientById = (id: string) => {
    return clients.find(c => c.id === id) || null;
  }

  return { isReady, error, recognize, getClientById };
}