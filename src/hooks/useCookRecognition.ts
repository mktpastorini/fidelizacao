import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cozinheiro } from '@/types/supabase';

export type CookRecognitionResult = {
  cook: Cozinheiro;
  distance: number;
} | null;

export function useCookRecognition() {
  const [isReady, setIsReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (imageSrc: string): Promise<CookRecognitionResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-cook-face', {
        body: { image_url: imageSrc },
      });

      if (functionError) throw functionError;

      setIsLoading(false);
      if (data.match) {
        return { cook: data.match as Cozinheiro, distance: data.distance };
      }
      return null;

    } catch (err: any) {
      console.error("Erro ao invocar a função de reconhecimento do cozinheiro:", err);
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o serviço de reconhecimento.";
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, []);

  return { isReady, isLoading, error, recognize };
}