import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cozinheiro } from '@/types/supabase';
import { usePerformance } from '@/contexts/PerformanceContext';
import { toast } from 'sonner';

export type CookMatch = {
  cook: Cozinheiro;
  distance: number;
};

export function useCookRecognition() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPerformanceModeEnabled } = usePerformance();

  const recognize = useCallback(async (imageSrc: string): Promise<CookMatch | null> => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-cook-compreface', {
        body: { image_url: imageSrc },
      });

      if (functionError) throw functionError;

      if (data.cook) {
        return { cook: data.cook as Cozinheiro, distance: data.distance };
      }
      return null;

    } catch (err: any) {
      console.error("Erro ao invocar a função de reconhecimento do cozinheiro:", err);
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o serviço de reconhecimento.";
      setError(errorMessage);
      return null;
    } finally {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      if (isPerformanceModeEnabled) {
        toast.info(`Reconhecimento de cozinheiro: ${duration}ms`);
      }
      setIsLoading(false);
    }
  }, [isPerformanceModeEnabled]);

  return { isLoading, error, recognize };
}