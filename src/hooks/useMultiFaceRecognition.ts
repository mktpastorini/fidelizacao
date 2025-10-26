import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';

export type FaceMatch = {
  client: Cliente;
  similarity: number;
  box: {
    x_max: number;
    x_min: number;
    y_max: number;
    y_min: number;
  };
};

export function useMultiFaceRecognition() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognizeMultiple = useCallback(async (imageSrc: string, minSimilarity?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-multiple-faces-compreface', {
        body: { image_url: imageSrc, min_similarity: minSimilarity },
      });

      if (functionError) throw functionError;

      setIsLoading(false);
      if (data.matches && Array.isArray(data.matches)) {
        return data.matches as FaceMatch[];
      }
      return [];

    } catch (err: any) {
      console.error("Erro ao invocar a função de reconhecimento de múltiplas faces:", err);
      const errorMessage = err.context?.error_message || err.message || "Falha na comunicação com o serviço de reconhecimento.";
      setError(errorMessage);
      setIsLoading(false);
      return [];
    }
  }, []);

  return { isLoading, error, recognizeMultiple };
}