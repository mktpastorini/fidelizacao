import { useState, useRef } from "react";
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
import { Users, Table, CheckCircle, DollarSign, ReceiptText, Camera } from "lucide-react";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";

type DashboardData = {
  clientes: Cliente[];
  mesas: Mesa[];
};

type FinancialStats = {
  revenue_today: number;
  avg_ticket_today: number;
};

async function fetchDashboardData(): Promise<DashboardData> {
  const { data: clientes, error: clientesError } = await supabase
    .from("clientes")
    .select("*, filhos(*)");
  if (clientesError) throw new Error(clientesError.message);

  const { data: mesas, error: mesasError } = await supabase
    .from("mesas")
    .select("*");
  if (mesasError) throw new Error(mesasError.message);

  return { clientes: clientes || [], mesas: mesas || [] };
}

async function fetchFinancialStats(): Promise<FinancialStats> {
  const { data, error } = await supabase.rpc('get_financial_stats_today');
  if (error) throw new Error(error.message);
  return data;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const webcamRef = useRef<Webcam>(null);
  
  const [isRecognitionDialogOpen, setIsRecognitionDialogOpen] = useState(false);
  const [isArrivalModalOpen, setIsArrivalModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  
  const [recognizedClient, setRecognizedClient] = useState<Cliente | null>(null);
  const [lastArrivedClient, setLastArrivedClient] = useState<Cliente | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: fetchDashboardData,
  });

  const { data: financialStats } = useQuery({
    queryKey: ["financialStats"],
    queryFn: fetchFinancialStats,
  });

  const mesasOcupadas = data?.mesas.filter(m => m.cliente_id).length || 0;
  const mesasLivres = data?.mesas.filter(m => !m.cliente_id) || [];

  const sendWelcomeMessageMutation = useMutation({
    mutationFn: async (cliente: Cliente) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase.functions.invoke('send-welcome-message', { 
        body: { clientId: cliente.id, userId: user.id } 
      });

      if (error) {
        const detailedError = (error as any).context?.error || error.message;
        throw new Error(detailedError);
      }
    },
  });

  const allocateTableMutation = useMutation({
    mutationFn: async ({ clienteId, mesaId }: { clienteId: string; mesaId: string }) => {
      const { error } = await supabase.from("mesas").update({ cliente_id: clienteId }).eq("id", mesaId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      showSuccess("Cliente alocado com sucesso!");
      onArrivalModalChange(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const addClienteAndRegisterFaceMutation = useMutation({
    mutationFn: async (newCliente: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      let gostos = null;
      try {
        if (newCliente.gostos) gostos = JSON.parse(newCliente.gostos);
      } catch (e) {
        throw new Error("Formato de 'Gostos' inválido. Use JSON.");
      }

      const { filhos, ...clienteDataToInsert } = newCliente;
      const { data: clienteData, error: clienteError } = await supabase.from("clientes").insert([{ ...clienteDataToInsert, gostos, user_id: userId }]).select().single();
      if (clienteError) throw new Error(`Erro ao criar cliente: ${clienteError.message}`);

      const newClientId = clienteData.id;

      if (filhos && filhos.length > 0) {
        const filhosData = filhos.map((filho: any) => ({ ...filho, cliente_id: newClientId, user_id: userId }));
        const { error: filhosError } = await supabase.from("filhos").insert(filhosData);
        if (filhosError) throw new Error(`Erro ao adicionar filhos: ${filhosError.message}`);
      }

      if (clienteData.avatar_url) {
        const { error: faceError } = await supabase.functions.invoke('register-face', {
          body: { cliente_id: newClientId, image_url: clienteData.avatar_url },
        });
        if (faceError) {
          showError(`Cliente criado, mas falha ao registrar o rosto: ${faceError.message}`);
        }
      }
      return clienteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente adicionado e rosto registrado com sucesso!");
      setIsNewClientModalOpen(false);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

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
      onError: (error: Error) => {
        dismissToast(toastId);
        showError(`Falha no webhook: ${error.message}. Verifique suas configurações. Prosseguindo com a alocação...`);
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
    addClienteAndRegisterFaceMutation.mutate(values);
  };

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
        <StatCard title="Faturamento do Dia" value={formatCurrency(financialStats?.revenue_today)} icon={DollarSign} />
        <StatCard title="Ticket Médio (Dia)" value={formatCurrency(financialStats?.avg_ticket_today)} icon={ReceiptText} />
        <StatCard title="Total de Clientes" value={data?.clientes.length ?? 0} icon={Users} />
        <StatCard title="Mesas Ocupadas" value={`${mesasOcupadas} de ${data?.mesas.length ?? 0}`} icon={Table} />
        <StatCard title="Taxa de Ocupação" value={`${data?.mesas.length ? Math.round((mesasOcupadas / data.mesas.length) * 100) : 0}%`} icon={CheckCircle} />
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
            <Button size="lg" className="w-full" onClick={() => setIsRecognitionDialogOpen(true)} disabled={!isCameraActive}>
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
        onClientRecognized={handleClientRecognized}
        onNewClient={handleNewClient}
      />

      <NewClientDialog
        isOpen={isNewClientModalOpen}
        onOpenChange={setIsNewClientModalOpen}
        onSubmit={handleNewClientSubmit}
        isSubmitting={addClienteAndRegisterFaceMutation.isPending}
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