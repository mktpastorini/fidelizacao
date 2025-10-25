import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Cliente, Produto } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, UserPlus, Loader2, Camera, VideoOff, RefreshCw, User } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { QuickClientForm } from './QuickClientForm';
import { supabase } from '@/integrations/supabase/client';
import * as z from 'zod';

type ItemToOrder = {
  produto: Produto;
  quantidade: number;
  observacoes: string;
};

type ClientIdentificationModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  itemToOrder: ItemToOrder | null;
  mesaId: string;
  mesaUserId: string;
  onOrderConfirmed: (clienteId: string | null) => void;
};

type FaceRecognitionResult = {
  client: Cliente;
  distance: number;
} | null;

// Hook useFaceRecognition modificado para aceitar mesaId
function useFaceRecognitionForMenu() {
  const [isReady, setIsReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(async (imageSrc: string, mesaId: string): Promise<FaceRecognitionResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('recognize-face-compreface', {
        body: { image_url: imageSrc, mesa_id: mesaId }, // Passando mesa_id
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


export function ClientIdentificationModal({
  isOpen,
  onOpenChange,
  itemToOrder,
  mesaId,
  mesaUserId,
  onOrderConfirmed,
}: ClientIdentificationModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isScanning, error: recognitionError, recognize } = useFaceRecognitionForMenu(); // Usando o hook modificado
  
  const [step, setStep] = useState<'capture' | 'identifying' | 'match' | 'no_match' | 'quick_register'>('capture');
  const [match, setMatch] = useState<Cliente | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isSubmittingNewClient, setIsSubmittingNewClient] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null); // Novo estado para erro de mídia

  // REMOVENDO deviceId: settings?.preferred_camera_device_id
  const videoConstraints = {
    width: 400,
    height: 400,
    // deviceId: settings?.preferred_camera_device_id ? { exact: settings.preferred_camera_device_id } : undefined,
  };

  const resetState = useCallback(() => {
    setMatch(null);
    setSnapshot(null);
    setStep('capture');
    setMediaError(null); // Resetar erro de mídia
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleMediaError = useCallback((err: any) => {
    console.error("Erro ao acessar a câmera:", err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setMediaError("Acesso à câmera negado. Por favor, permita o acesso nas configurações do seu navegador.");
    } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setMediaError("Acesso à câmera bloqueado. O menu deve ser acessado via HTTPS.");
    } else {
      setMediaError(`Erro de mídia: ${err.message}`);
    }
  }, []);

  const performRecognition = useCallback(async (imageSrc: string) => {
    if (!isReady || !recognize) return;

    setStep('identifying');
    // Passando mesaId para o Edge Function
    const result = await recognize(imageSrc, mesaId); 
    
    if (result) {
      setMatch(result.client);
      setStep('match');
    } else {
      setMatch(null);
      setStep('no_match');
    }
  }, [isReady, recognize, mesaId]);

  const handleCapture = useCallback(() => {
    if (mediaError) {
      showError(mediaError);
      return;
    }
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setSnapshot(imageSrc);
        performRecognition(imageSrc);
      } else {
        showError("Não foi possível capturar a imagem. Tente novamente.");
      }
    }
  }, [performRecognition, mediaError]);

  const handleConfirmMatch = () => {
    if (match) {
      onOrderConfirmed(match.id);
      onOpenChange(false);
    }
  };

  const handleQuickRegister = async (values: z.infer<typeof QuickClientForm>) => {
    if (!values.avatar_url) {
      showError("A foto é obrigatória para o cadastro rápido.");
      return;
    }
    setIsSubmittingNewClient(true);

    try {
      // 1. Cria o cliente (usando a função RPC para garantir a contagem de indicações)
      const { error: rpcError, data: newClientId } = await supabase.rpc('create_client_with_referral', {
        p_user_id: mesaUserId, 
        p_nome: values.nome, 
        p_casado_com: null,
        p_whatsapp: values.whatsapp, 
        p_gostos: null, 
        p_avatar_url: values.avatar_url,
        p_indicado_por_id: null,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (!newClientId) throw new Error("Falha ao obter o ID do novo cliente após a criação.");

      // 2. Adicionar o novo cliente como ocupante da mesa
      const { error: occupantError } = await supabase
        .from("mesa_ocupantes")
        .insert({
          mesa_id: mesaId,
          cliente_id: newClientId,
          user_id: mesaUserId,
        });
      if (occupantError) {
        // Se falhar ao adicionar como ocupante, é melhor reverter o cadastro do cliente para evitar inconsistência.
        await supabase.from("clientes").delete().eq("id", newClientId);
        throw new Error(`Falha ao adicionar cliente à mesa: ${occupantError.message}`);
      }

      // 3. Registra a face no CompreFace
      const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
        body: { subject: newClientId, image_urls: [values.avatar_url] }
      });
      if (faceError) {
        // Se falhar o registro facial, remove o cliente para evitar inconsistência
        await supabase.from("clientes").delete().eq("id", newClientId);
        throw new Error(`O cadastro falhou durante o registro facial. Erro: ${faceError.message}`);
      }

      showSuccess(`Bem-vindo(a), ${values.nome}! Seu pedido foi adicionado.`);
      onOrderConfirmed(newClientId);
      onOpenChange(false);

    } catch (error: any) {
      showError(`Erro no cadastro rápido: ${error.message}`);
    } finally {
      setIsSubmittingNewClient(false);
    }
  };

  const handleCancelIdentification = () => {
    // Adiciona o pedido como Mesa (Geral)
    onOrderConfirmed(null);
    onOpenChange(false);
  };

  const renderContent = () => {
    const displayError = recognitionError || mediaError;

    if (displayError) {
      return (
        <div className="text-center py-4 space-y-4">
          <p className="text-lg font-bold text-destructive">Erro de Câmera/Reconhecimento</p>
          <p className="text-sm text-muted-foreground">{displayError}</p>
          <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
        </div>
      );
    }

    switch (step) {
      case 'capture':
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-primary/50 flex items-center justify-center bg-black shadow-xl">
              <Webcam 
                audio={false} 
                ref={webcamRef} 
                screenshotFormat="image/jpeg" 
                videoConstraints={videoConstraints} 
                className="w-full h-full object-cover" 
                mirrored={true}
                onUserMediaError={handleMediaError} // Captura erros de mídia
              />
            </div>
            <Button onClick={handleCapture} disabled={!isReady} className="w-full max-w-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              <Camera className="w-4 h-4 mr-2" /> Capturar Rosto
            </Button>
          </div>
        );
      case 'identifying':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-lg text-primary">Analisando...</p>
          </div>
        );
      case 'match':
        return (
          <div className="text-center py-4 space-y-4">
            <Avatar className="w-20 h-20 mx-auto ring-2 ring-primary ring-offset-2 ring-offset-card">
              <AvatarImage src={match?.avatar_url || undefined} />
              <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
            </Avatar>
            <p className="text-lg font-bold text-primary">Bem-vindo(a) de volta, {match?.nome}!</p>
            <p className="text-sm text-muted-foreground">Deseja atribuir o pedido a você?</p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
              <Button onClick={handleConfirmMatch} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Check className="w-4 h-4 mr-2" />Confirmar Pedido</Button>
            </div>
          </div>
        );
      case 'no_match':
        return (
          <div className="text-center py-4 space-y-4">
            <p className="text-lg font-bold text-destructive">Cliente não encontrado.</p>
            <p className="text-sm text-muted-foreground">O que deseja fazer?</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
              <Button onClick={() => setStep('quick_register')} className="bg-primary hover:bg-primary/90 text-primary-foreground"><UserPlus className="w-4 h-4 mr-2" />Cadastrar Rápido</Button>
              <Button variant="ghost" onClick={handleCancelIdentification} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4 mr-2" /> Continuar como Mesa (Geral)
              </Button>
            </div>
          </div>
        );
      case 'quick_register':
        return (
          <div className="space-y-4">
            <DialogDescription>
              Preencha apenas o essencial para que possamos te reconhecer na próxima vez.
            </DialogDescription>
            <QuickClientForm 
              onSubmit={handleQuickRegister} 
              isSubmitting={isSubmittingNewClient} 
            />
          </div>
        );
      default:
        return null;
    }
  };

  const dialogTitle = useMemo(() => {
    if (step === 'quick_register') return "Cadastro Rápido";
    if (step === 'match') return "Cliente Identificado";
    return "Identificação Facial";
  }, [step]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">{dialogTitle}</DialogTitle>
          {step !== 'quick_register' && (
            <DialogDescription>
              {itemToOrder?.produto.nome} (x{itemToOrder?.quantidade})
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="py-4">
          {renderContent()}
        </div>
        {step === 'capture' && !mediaError && (
          <DialogFooter>
            <Button variant="ghost" onClick={handleCancelIdentification} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4 mr-2" /> Pedir como Mesa (Geral)
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}