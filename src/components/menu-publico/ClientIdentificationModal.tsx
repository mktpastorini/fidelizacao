import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { Cliente, Produto } from '@/types/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, UserPlus, Loader2, Camera, VideoOff, RefreshCw, User } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useFaceRecognition, FaceRecognitionResult } from '@/hooks/useFaceRecognition';
import { useSettings } from '@/contexts/SettingsContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { QuickRegistrationStepper } from './QuickRegistrationStepper';
import { supabase } from '@/integrations/supabase/client';
import * as z from 'zod';
import { useQueryClient } from '@tanstack/react-query';

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
  mode: 'order' | 'occupy'; // NOVO CAMPO
  onOrderConfirmed: (clienteId: string | null) => void;
  onTableOccupied: (clienteId: string) => void; // NOVO CAMPO
};

export function ClientIdentificationModal({
  isOpen,
  onOpenChange,
  itemToOrder,
  mesaId,
  mesaUserId,
  mode, // NOVO
  onOrderConfirmed,
  onTableOccupied, // NOVO
}: ClientIdentificationModalProps) {
  const queryClient = useQueryClient();
  const webcamRef = useRef<Webcam>(null);
  const { settings } = useSettings();
  const { isReady, isLoading: isScanning, error: recognitionError, recognize } = useFaceRecognition();
  
  const [step, setStep] = useState<'capture' | 'identifying' | 'match' | 'no_match' | 'quick_register'>('capture');
  const [match, setMatch] = useState<Cliente | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isSubmittingNewClient, setIsSubmittingNewClient] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const videoConstraints = {
    width: 400,
    height: 400,
    facingMode: "user",
    deviceId: settings?.preferred_camera_device_id || undefined,
  };

  const resetState = useCallback(() => {
    setMatch(null);
    setSnapshot(null);
    setStep('capture');
    setMediaError(null);
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
    if (!isReady || !recognize || step !== 'capture') return;

    setStep('identifying');
    const result = await recognize(imageSrc); 
    
    if (result?.status === 'MATCH_FOUND' && result.match) {
      setMatch(result.match);
      setStep('match');
    } else if (result?.status === 'NO_MATCH' || result?.status === 'NO_FACE_DETECTED') {
      setMatch(null);
      setStep('no_match');
      if (result.message) showError(result.message);
    } else {
      setMatch(null);
      setStep('no_match');
      showError("Falha desconhecida no reconhecimento.");
    }
  }, [isReady, recognize, step]);

  const handleCapture = useCallback(() => {
    if (mediaError || !webcamRef.current) {
      return;
    }
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setSnapshot(imageSrc);
      performRecognition(imageSrc);
    }
  }, [performRecognition, mediaError]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isOpen && step === 'capture' && !mediaError && isReady) {
      const timeoutId = setTimeout(() => {
        handleCapture();
        intervalId = setInterval(handleCapture, 2500);
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [isOpen, step, mediaError, isReady, handleCapture]);

  const handleConfirmMatch = async () => {
    if (!match) return;

    if (mode === 'occupy') {
      // Fluxo de Ocupação de Mesa
      try {
        const { data, error } = await supabase.functions.invoke('occupy-table-public', {
          body: { mesa_id: mesaId, cliente_id: match.id, user_id: mesaUserId },
        });
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "Falha ao ocupar a mesa.");
        
        showSuccess(data.message);
        onTableOccupied(match.id);
        onOpenChange(false);
        
      } catch (error: any) {
        showError(`Erro ao ocupar mesa: ${error.message}`);
      }
    } else {
      // Fluxo de Pedido
      onOrderConfirmed(match.id);
      onOpenChange(false);
    }
  };

  const handleQuickRegister = async (values: { nome: string; whatsapp?: string; avatar_url: string; }) => {
    if (!values.avatar_url) {
      showError("A foto é obrigatória para o cadastro rápido.");
      return;
    }
    setIsSubmittingNewClient(true);

    try {
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

      // 1. Adicionar face ao CompreFace
      const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
        body: { subject: newClientId, image_urls: [values.avatar_url] }
      });
      if (faceError) {
        await supabase.from("clientes").delete().eq("id", newClientId);
        throw new Error(`O cadastro do cliente falhou durante o registro facial. A operação foi desfeita. Erro original: ${faceError.message}`);
      }

      // 2. Se for modo 'occupy', chama a função de ocupação
      if (mode === 'occupy') {
        const { data, error } = await supabase.functions.invoke('occupy-table-public', {
          body: { mesa_id: mesaId, cliente_id: newClientId, user_id: mesaUserId },
        });
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || "Falha ao ocupar a mesa.");
        
        showSuccess(`Bem-vindo(a), ${values.nome}! Mesa ocupada com sucesso.`);
        onTableOccupied(newClientId);
        onOpenChange(false);
        
      } else {
        // 3. Se for modo 'order', adiciona o ocupante e confirma o pedido
        const { error: occupantError } = await supabase.functions.invoke('add-occupant-public', {
          body: {
            mesa_id: mesaId,
            cliente_id: newClientId,
            user_id: mesaUserId,
          }
        });
        if (occupantError) {
          await supabase.from("clientes").delete().eq("id", newClientId);
          throw new Error(`Falha ao adicionar cliente à mesa: ${occupantError.message}`);
        }
        
        showSuccess(`Bem-vindo(a), ${values.nome}! Seu pedido foi adicionado.`);
        onOrderConfirmed(newClientId);
        onOpenChange(false);
      }

    } catch (error: any) {
      showError(`Erro no cadastro rápido: ${error.message}`);
    } finally {
      setIsSubmittingNewClient(false);
    }
  };

  const handleCancelIdentification = () => {
    if (mode === 'occupy') {
      // No modo ocupar, não há opção de continuar como Mesa Geral
      onOpenChange(false);
    } else {
      // No modo pedido, permite continuar como Mesa Geral
      onOrderConfirmed(null);
      onOpenChange(false);
    }
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
                onUserMediaError={handleMediaError}
              />
            </div>
            <div className="text-center h-10 flex items-center justify-center">
              <p className="text-muted-foreground animate-pulse">Posicione o rosto na câmera...</p>
            </div>
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
            <p className="text-sm text-muted-foreground">
              {mode === 'occupy' ? "Deseja ocupar esta mesa?" : "Deseja atribuir o pedido a você?"}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={resetState}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
              <Button onClick={handleConfirmMatch} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Check className="w-4 h-4 mr-2" />
                {mode === 'occupy' ? "Ocupar Mesa" : "Confirmar Pedido"}
              </Button>
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
              {mode === 'order' && (
                <Button variant="ghost" onClick={handleCancelIdentification} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4 mr-2" /> Continuar como Mesa (Geral)
                </Button>
              )}
            </div>
          </div>
        );
      case 'quick_register':
        return (
          <QuickRegistrationStepper 
            onSubmit={handleQuickRegister} 
            isSubmitting={isSubmittingNewClient} 
          />
        );
      default:
        return null;
    }
  };

  const dialogTitle = useMemo(() => {
    if (step === 'quick_register') return "Cadastro Rápido";
    if (step === 'match') return "Cliente Identificado";
    return mode === 'occupy' ? "Ocupar Mesa via Reconhecimento" : "Identificação Facial";
  }, [step, mode]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">{dialogTitle}</DialogTitle>
          {step !== 'quick_register' && mode === 'order' && itemToOrder && (
            <DialogDescription>
              {itemToOrder.produto.nome} (x{itemToOrder.quantidade})
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="py-4">
          {renderContent()}
        </div>
        {step === 'capture' && !mediaError && mode === 'order' && (
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