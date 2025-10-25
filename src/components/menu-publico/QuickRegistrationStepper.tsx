import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, RefreshCw, Check, ArrowRight, ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import Webcam from 'react-webcam';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';

type StepperProps = {
  onSubmit: (values: { nome: string; whatsapp?: string; avatar_url: string }) => void;
  isSubmitting: boolean;
};

const steps = ["Foto", "Nome", "Contato"];

export function QuickRegistrationStepper({ onSubmit, isSubmitting }: StepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    nome: "",
    whatsapp: "",
    avatar_url: "",
  });
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setSnapshot(imageSrc);
    }
  }, [webcamRef]);

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  const handleConfirmPhoto = async () => {
    if (!snapshot) return;
    setIsUploading(true);
    const file = dataURLtoFile(snapshot, `face-${Date.now()}.jpg`);
    if (!file) {
      showError("Não foi possível converter a imagem.");
      setIsUploading(false);
      return;
    }

    try {
      const filePath = `public/faces/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('client_avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('client_avatars').getPublicUrl(filePath);
      if (!data.publicUrl) throw new Error("URL pública não encontrada.");

      setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }));
      setCurrentStep(1);
    } catch (error: any) {
      showError(`Erro ao salvar foto: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && formData.nome.trim().length < 2) {
      showError("Por favor, insira seu nome.");
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center bg-black">
              {snapshot ? (
                <img src={snapshot} alt="Rosto" className="w-full h-full object-cover" />
              ) : (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ width: 400, height: 400, facingMode: "user" }}
                  className="w-full h-full object-cover"
                  mirrored={true}
                />
              )}
            </div>
            {snapshot ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSnapshot(null)} disabled={isUploading}><RefreshCw className="w-4 h-4 mr-2" />Tirar Outra</Button>
                <Button onClick={handleConfirmPhoto} disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Confirmar Foto
                </Button>
              </div>
            ) : (
              <Button onClick={handleCapture}><Camera className="w-4 h-4 mr-2" />Capturar Rosto</Button>
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-2">
            <Label htmlFor="nome">Qual o seu nome?</Label>
            <Input
              id="nome"
              placeholder="Seu nome completo"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              autoFocus
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-2">
            <Label htmlFor="whatsapp">Seu WhatsApp (Opcional)</Label>
            <Input
              id="whatsapp"
              placeholder="(99) 99999-9999"
              value={formData.whatsapp}
              onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
              autoFocus
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center space-x-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${currentStep >= index ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
              {index + 1}
            </div>
            <span className={`font-medium ${currentStep >= index ? 'text-primary' : 'text-muted-foreground'}`}>{step}</span>
          </div>
        ))}
      </div>
      
      <div className="min-h-[320px] flex items-center justify-center">
        {renderStep()}
      </div>

      <div className="flex justify-between">
        {currentStep > 0 ? (
          <Button variant="outline" onClick={handleBack}><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button>
        ) : <div />}
        
        {currentStep < steps.length - 1 ? (
          <Button onClick={handleNext}>Avançar<ArrowRight className="w-4 h-4 ml-2" /></Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Finalizar Cadastro
          </Button>
        )}
      </div>
    </div>
  );
}