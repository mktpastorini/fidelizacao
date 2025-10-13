import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Cliente } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Check, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type FacialRecognitionDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clientes: (Cliente & { face_image_url?: string })[];
  onClientRecognized: (cliente: Cliente) => void;
};

const videoConstraints = {
  width: 720,
  height: 720,
  facingMode: 'user',
};

export function FacialRecognitionDialog({ isOpen, onOpenChange, clientes, onClientRecognized }: FacialRecognitionDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [match, setMatch] = useState<(Cliente & { face_image_url?: string }) | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const handleScan = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setSnapshot(imageSrc);
      setIsScanning(true);
      // --- SIMULAÇÃO DE RECONHECIMENTO ---
      // Em um sistema real, aqui você enviaria a imagem para uma API de IA.
      // Para este protótipo, vamos simular uma busca e encontrar um "match".
      setTimeout(() => {
        // Vamos pegar o cliente mais recente que tenha uma foto de rosto cadastrada.
        const clientWithFace = clientes.find(c => c.avatar_url); // Simplificando: usando avatar como ref.
        setMatch(clientWithFace || null);
        setIsScanning(false);
      }, 2000);
    }
  }, [webcamRef, clientes]);

  const handleConfirm = () => {
    if (match) {
      onClientRecognized(match);
      reset();
    }
  };

  const reset = () => {
    setIsScanning(false);
    setMatch(null);
    setSnapshot(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reconhecimento Facial</DialogTitle>
          <DialogDescription>Posicione o cliente em frente à câmera e escaneie.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {!match && !snapshot && (
            <>
              <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                />
              </div>
              <Button onClick={handleScan} size="lg">Escanear Rosto</Button>
            </>
          )}

          {snapshot && (
            <div className="text-center">
              <h3 className="font-semibold mb-4">Resultado do Escaneamento</h3>
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
                  <p className="text-xs mt-1">Cliente Encontrado</p>
                </div>
              </div>
              
              {isScanning ? (
                <p className="mt-4 animate-pulse">Analisando...</p>
              ) : match ? (
                <div className="mt-6">
                  <p className="text-lg">Cliente reconhecido:</p>
                  <p className="text-2xl font-bold">{match.nome}</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" onClick={reset}><X className="w-4 h-4 mr-2" />Incorreto</Button>
                    <Button onClick={handleConfirm}><Check className="w-4 h-4 mr-2" />Confirmar</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-lg font-bold text-red-600">Nenhum cliente correspondente encontrado.</p>
                  <Button variant="outline" onClick={reset} className="mt-4">Tentar Novamente</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}