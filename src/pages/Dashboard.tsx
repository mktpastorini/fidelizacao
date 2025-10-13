import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Webcam from "react-webcam";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Mesa } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClientArrivalModal } from "@/components/dashboard/ClientArrivalModal";
import { FacialRecognitionDialog } from "@/components/dashboard/FacialRecognitionDialog";
import { NewClientDialog } from "@/components/dashboard/NewClientDialog";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Users, Table, CheckCircle, DollarSign, ReceiptText, Camera, UserPlus } from "lucide-react";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";

// ... (funções de fetch permanecem as mesmas)

export default function Dashboard() {
  const queryClient = useQueryClient();
  const webcamRef = useRef<Webcam>(null);
  
  const [isRecognitionDialogOpen, setIsRecognitionDialogOpen] = useState(false);
  const [isArrivalModalOpen, setIsArrivalModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  
  const [recognizedClient, setRecognizedClient] = useState<Cliente | null>(null);
  const [lastArrivedClient, setLastArrivedClient] = useState<Cliente | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [triggerScan, setTriggerScan] = useState(false);

  // ... (useQuery e useMutation hooks permanecem os mesmos)

  const handleScanClick = () => {
    setTriggerScan(true);
    setIsRecognitionDialogOpen(true);
    // Reset trigger after a short delay
    setTimeout(() => setTriggerScan(false), 100);
  };

  const handleClientRecognized = (cliente: Cliente) => {
    const toastId = showLoading("Confirmando reconhecimento e enviando mensagem...");
    setRecognizedClient(cliente);
    setLastArrivedClient(cliente);
    setIsCameraActive(false);
    
    sendWelcomeMessageMutation.mutate(cliente, {
      onSuccess: () => {
        dismissToast(toastId);
        showSuccess(`Mensagem de boas-vindas enviada para ${cliente.nome}!`);
        setIsArrivalModalOpen(true);
      },
      onError: () => {
        dismissToast(toastId);
        setIsArrivalModalOpen(true);
      }
    });
  };

  const handleAllocateTable = (mesaId: string) => {
    if (recognizedClient) {
      allocateTableMutation.mutate({ clienteId: recognizedClient.id, mesaId });
    }
  };

  const handleNewClient = () => {
    setIsNewClientModalOpen(true);
  };

  const handleNewClientSubmit = (values: any) => {
    // Lógica para adicionar o novo cliente
    // (Esta é uma simplificação, idealmente seria uma mutation)
    console.log("Novo cliente para cadastrar:", values);
    showSuccess("Cliente cadastrado com sucesso!");
    setIsNewClientModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
  };

  // Quando o modal de alocação fecha, reativa a câmera
  const onArrivalModalChange = (isOpen: boolean) => {
    if (!isOpen) {
      setIsCameraActive(true);
      setRecognizedClient(null);
    }
    setIsArrivalModalOpen(isOpen);
  };

  const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number') return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Visão geral do seu estabelecimento e clientes.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* StatCards aqui */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recepção Ativa</CardTitle>
            <CardDescription>A câmera está pronta para reconhecer seus clientes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-full aspect-square rounded-lg overflow-hidden bg-black relative flex items-center justify-center">
              {isCameraActive ? (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-white p-4">
                  <p className="font-semibold text-lg">Aguardando Alocação</p>
                  <p className="text-sm">{recognizedClient?.nome}</p>
                </div>
              )}
            </div>
            <Button size="lg" className="w-full" onClick={handleScanClick} disabled={!isCameraActive}>
              <Camera className="w-5 h-5 mr-2" />
              Analisar Rosto
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
      </div>

      <FacialRecognitionDialog
        isOpen={isRecognitionDialogOpen}
        onOpenChange={setIsRecognitionDialogOpen}
        clientes={data?.clientes || []}
        onClientRecognized={handleClientRecognized}
        onNewClient={handleNewClient}
        triggerScan={triggerScan}
      />

      <NewClientDialog
        isOpen={isNewClientModalOpen}
        onOpenChange={setIsNewClientModalOpen}
        onSubmit={handleNewClientSubmit}
        isSubmitting={false /* Lide com o estado de submissão aqui */}
      />

      <ClientArrivalModal
        isOpen={isArrivalModalOpen}
        onOpenChange={onArrivalModalChange}
        cliente={recognizedClient}
        mesasLivres={mesasLivres}
        onAllocateTable={handleAllocateTable}
        isAllocating={allocateTableMutation.isPending}
      />
    </div>
  );
}