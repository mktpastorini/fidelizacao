import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';
import { usePerformance } from '@/contexts/PerformanceContext';
import { toast } from 'sonner';

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
  const { isPerformanceModeEnabled } = usePerformance();

  const recognize = useCallback(async (imageSrc: string): Promise<FaceRecognitionResult> => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-face-compreface', {
        body: { image_url: imageSrc },
      });

      if (functionError) throw functionError;

      if (data.success) {
        const { success, ...result } = data;
        return result as FaceRecognitionResult;
      }
      return null;

    } catch (err: any) {
      console.error("Erro ao invocar a função de reconhecimento:", err);
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o serviço de reconhecimento.";
      setError(errorMessage);
      return null;
    } finally {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      if (isPerformanceModeEnabled) {
        toast.info(`Reconhecimento facial: ${duration}ms`);
      }
      setIsLoading(false);
    }
  }, [isPerformanceModeEnabled]);

  return { isReady, isLoading, error, recognize };
}