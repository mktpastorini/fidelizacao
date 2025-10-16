import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Cliente } from '@/types/supabase';

export function useFaceRecognition() {
  const [isReady, setIsReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Cliente[]>([]);

  useEffect(() => {
    const fetchClients = async () => {
      setIsLoading(true);
      const { data, error: clientError } = await supabase.from('clientes').select('*');
      if (clientError) {
        setError("Falha ao carregar lista de clientes para reconhecimento.");
      } else {
        setClients(data || []);
      }
      setIsLoading(false);
    };
    fetchClients();
  }, []);

  const recognize = useCallback(async (imageElement: HTMLImageElement) => {
    setError(null);
    
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError("Não foi possível obter o contexto do canvas.");
      return null;
    }
    ctx.drawImage(imageElement, 0, 0);
    const imageUrl = canvas.toDataURL('image/jpeg');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-face', {
        body: { image_url: imageUrl, ai_provider: 'google-vision' },
      });

      if (functionError) throw functionError;

      if (data.match) {
        return { label: data.match.id, distance: data.distance };
      }
      return null;

    } catch (err: any) {
      console.error("Erro ao invocar a função de reconhecimento:", err);
      setError(err.message || "Falha ao se comunicar com o serviço de reconhecimento.");
      return null;
    }
  }, []);

  const getClientById = useCallback((id: string) => {
    return clients.find(c => c.id === id) || null;
  }, [clients]);

  return { isReady, isLoading, error, recognize, getClientById };
}