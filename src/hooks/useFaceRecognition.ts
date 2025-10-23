import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';

export function useFaceRecognition() {
  const [isReady, setIsReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (imageSrc: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Não passamos token de autenticação, pois o Edge Function agora usa a Service Role Key
      const { data, error: functionError } = await supabase.functions.invoke('recognize-face-compreface', {
        body: { image_url: imageSrc },
      });

      if (functionError) throw functionError;

      setIsLoading(false);
      if (data.match) {
        return { client: data.match as Cliente, distance: data.distance };
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