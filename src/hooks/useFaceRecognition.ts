import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';

export type FaceRecognitionResult = {
  status: 'MATCH_FOUND' | 'NO_MATCH' | 'NO_FACE_DETECTED';
  match?: Cliente;
  similarity?: number;
  message?: string;
} | null;

export function useFaceRecognition() {
  const [isReady, setIsReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (imageSrc: string): Promise<FaceRecognitionResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-face-compreface', {
        body: { image_url: imageSrc },
      });

      if (functionError) throw functionError;

      setIsLoading(false);
      if (data.success) {
        const { success, ...result } = data;
        return result as FaceRecognitionResult;
      }
      return null;

    } catch (err: any) {
      console.error("Erro ao invocar a função de reconhecimento:", err);
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o serviço de reconhecimento.";
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, []);

  return { isReady, isLoading, error, recognize };
}