import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Cliente } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Check, X, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

type FacialRecognitionDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClientRecognized: (cliente: Cliente) => void;
  onNewClient: () => void;
};

export function FacialRecognitionDialog({ isOpen, onOpenChange, onClientRecognized, onNewClient }: FacialRecognitionDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [match, setMatch] = useState<Cliente | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const resetState = () => {
    setIsScanning(false);
    setMatch(null);
    setSnapshot(null);
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }

    const performRecognition = async (imageUrl: string) => {
      setIsScanning(true);
      setMatch(null);

      try {
        const { data, error } = await supabase.functions.invoke('recognize-face', {
          body: { image_url: imageUrl },
        });

        if (error) throw error;

        if (data.match) {
          setMatch(data.match);
        } else {
          setMatch(null);
        }
      } catch (err: any) {
        showError(`Erro no reconhecimento: ${err.message}`);
        setMatch(null);
      } finally {
        setIsScanning(false);
      }
    };

    const scanTimeout = setTimeout(() => {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        setSnapshot(imageSrc);
        performRecognition(imageSrc);
      }
    }, 1000); // Delay to allow camera initialization

    return () => clearTimeout(scanTimeout);
  }, [isOpen]);

  const handleConfirm = () => {
    if (match) {
      onClientRecognized(match);
      onOpenChange(false);
    }
  };

  const handleNewClient = () => {
    onNewClient();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Analisando Rosto</DialogTitle>
          <DialogDescription>Aguarde enquanto identificamos o cliente.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={{ display: 'none' }}
          />
          {snapshot ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-4">
                <div>
                  <img src={snapshot} className="w-32 h-32 rounded-full object-cover border-2 border-blue-500" alt="Captura" />
                  <p className="text-xs mt-1">Captura Atual</p>
                </div>
                <div className="text-2xl font-light text-gray-300">...</div>
                <div>
                  {isScanning ? (
                    <Skeleton className="w-32 h-32 rounded-full" />
                  ) : match ? (
                    <Avatar className="w-32 h-32 border-2 border-green-500">
                      <AvatarImage src={match.avatar_url || undefined} />
                      <AvatarFallback><User className="h-16 w-16" /></AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-32 h-32 rounded-full border-2 border-red-500 bg-gray-100 flex items-center justify-center">
                      <User className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                  <p className="text-xs mt-1">Cliente na Base</p>
                </div>
              </div>
              
              {isScanning ? (
                <p className="mt-4 animate-pulse text-lg">Analisando...</p>
              ) : match ? (
                <div className="mt-6">
                  <p className="text-lg">Cliente reconhecido:</p>
                  <p className="text-2xl font-bold">{match.nome}</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}><X className="w-4 h-4 mr-2" />Incorreto</Button>
                    <Button onClick={handleConfirm}><Check className="w-4 h-4 mr-2" />Confirmar</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-lg font-bold text-red-600">Cliente não encontrado.</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Tentar Novamente</Button>
                    <Button onClick={handleNewClient}><UserPlus className="w-4 h-4 mr-2" />Cadastrar Novo Cliente</Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Inicializando câmera e preparando para análise...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}