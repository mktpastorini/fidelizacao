import { useState } from "react";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { FaceRegistration } from "@/components/clientes/FaceRegistration";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Cliente } from "@/types/supabase";

type NewClientDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: any) => void;
  isSubmitting: boolean;
  clientes: Cliente[];
};

export function NewClientDialog({ isOpen, onOpenChange, onSubmit, isSubmitting, clientes }: NewClientDialogProps) {
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleFaceRegistered = (url: string) => {
    setFaceImageUrl(url);
    toast.success("Foto capturada com sucesso! Agora, preencha os dados do cliente.");
    setShowForm(true);
  };

  const handleSubmit = (values: any) => {
    onSubmit({ ...values, avatar_url: faceImageUrl });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          <DialogDescription>
            Capture uma boa foto do cliente e depois preencha suas informações.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4">
          <div className="flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-2">1. Captura de Rosto</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Peça ao cliente para olhar diretamente para a câmera. Garanta uma boa iluminação.
            </p>
            <FaceRegistration
              onFaceRegistered={handleFaceRegistered}
              isSubmitting={isSubmitting}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">2. Informações do Cliente</h3>
            {showForm ? (
              <ClienteForm 
                onSubmit={handleSubmit} 
                isSubmitting={isSubmitting} 
                clientes={clientes} 
              />
            ) : (
              <div className="h-full flex items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  Após capturar a foto, o formulário de cadastro aparecerá aqui.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}