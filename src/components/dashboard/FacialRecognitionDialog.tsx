import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Cliente } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Check, X, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type FacialRecognitionDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clientes: (Cliente & { face_image_url?: string })[];
  onClientRecognized: (cliente: Cliente) => void;
  onNewClient: () => void;
  triggerScan: boolean;
};

export function FacialRecognitionDialog({ isOpen, onOpenChange, clientes, onClientRecognized, onNewClient, triggerScan }: FacialRecognitionDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [match, setMatch] = useState<(Cliente & { face_image_url?: string }) | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const handleScan = useCallback(() => {
    // This is a placeholder for the actual screenshot logic
    // In a real app, you might use webcamRef.current.getScreenshot()
    // For now, we'll simulate a snapshot to trigger the UI flow
    const imageSrc = "placeholder_snapshot"; // Simulate getting a snapshot
    if (imageSrc) {
      setSnapshot(imageSrc);
      setIsScanning(true);
      setTimeout(() => {
        // Improved simulation: randomly pick a client with a photo
        const clientsWithFaces = clientes.filter(c => c.avatar_url);
        const randomMatch = clientsWithFaces.length > 0 
          ? clientsWithFaces[Math.floor(Math.random() * clientsWithFaces.length)] 
          : null;
        setMatch(randomMatch);
        setIsScanning(false);
      }, 2000);
    }
  }, [clientes]);

  useEffect(() => {
    if (triggerScan && isOpen) {
      // A small delay to ensure the webcam is ready before scanning
      setTimeout(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
          setSnapshot(imageSrc);
          setIsScanning(true);
          setTimeout(() => {
            const clientsWithFaces = clientes.filter(c => c.avatar_url);
            const randomMatch = clientsWithFaces.length > 0 
              ? clientsWithFaces[Math.floor(Math.random() * clientsWithFaces.length)] 
              : null;
            setMatch(randomMatch);
            setIsScanning(false);
          }, 2000);
        }
      }, 100);
    }
  }, [triggerScan, isOpen, clientes]);

  const handleConfirm = () => {
    if (match) {
      onClientRecognized(match);
      reset();
    }
  };

  const handleNewClient = () => {
    onNewClient();
    reset();
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
          <DialogTitle>Analisando Rosto</DialogTitle>
          <DialogDescription>Aguarde enquanto identificamos o cliente.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {/* This is a hidden webcam to capture the image */}
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            style={{ display: 'none' }}
          />
          {snapshot && (
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
                    <Button variant="outline" onClick={reset}><X className="w-4 h-4 mr-2" />Incorreto</Button>
                    <Button onClick={handleConfirm}><Check className="w-4 h-4 mr-2" />Confirmar</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-lg font-bold text-red-600">Cliente não encontrado.</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button variant="outline" onClick={reset}>Tentar Novamente</Button>
                    <Button onClick={handleNewClient}><UserPlus className="w-4 h-4 mr-2" />Cadastrar Novo Cliente</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}