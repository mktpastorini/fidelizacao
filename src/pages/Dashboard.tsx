import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Mesa } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClientArrivalModal } from "@/components/dashboard/ClientArrivalModal";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Users, Table, CheckCircle, DollarSign, ReceiptText } from "lucide-react";
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
  const [isRecognitionDialogOpen, setIsRecognitionDialogOpen] = useState(false);
  const [isArrivalModalOpen, setIsArrivalModalOpen] = useState(false);
  const [recognizedClient, setRecognizedClient] = useState<Cliente | null>(null);
  const [lastArrivedClient, setLastArrivedClient] = useState<Cliente | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: fetchDashboardData,
  });

  const { data: financialStats, isLoading: isLoadingFinancial } = useQuery({
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
        body: { clientId: cliente.id, userId: user.id },
      });

      if (error) throw new Error(`Erro ao enviar webhook: ${error.message}`);
    },
    onError: (error: Error) => {
      showError(error.message);
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
      setIsArrivalModalOpen(false);
      setRecognizedClient(null);
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleClientRecognized = (cliente: Cliente) => {
    const toastId = showLoading("Reconhecendo cliente e enviando mensagem...");
    setRecognizedClient(cliente);
    setLastArrivedClient(cliente);
    setIsRecognitionDialogOpen(false);
    
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

      <RevenueChart />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Painel de Reconhecimento</CardTitle>
            <CardDescription>Simule a chegada e o reconhecimento facial de um cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isRecognitionDialogOpen} onOpenChange={setIsRecognitionDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">Simular Reconhecimento Facial</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Selecionar Cliente</DialogTitle>
                </DialogHeader>
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {data?.clientes.map((cliente) => (
                        <CommandItem key={cliente.id} onSelect={() => handleClientRecognized(cliente)}>
                          {cliente.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Último Cliente na Chegada</CardTitle>
            <CardDescription>Informações do último cliente que foi reconhecido.</CardDescription>
          </CardHeader>
          <CardContent>
            {lastArrivedClient ? (
              <div>
                <p className="font-semibold">{lastArrivedClient.nome}</p>
                <p className="text-sm text-gray-500">{lastArrivedClient.whatsapp}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aguardando a chegada do primeiro cliente...</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ClientArrivalModal
        isOpen={isArrivalModalOpen}
        onOpenChange={setIsArrivalModalOpen}
        cliente={recognizedClient}
        mesasLivres={mesasLivres}
        onAllocateTable={handleAllocateTable}
        isAllocating={allocateTableMutation.isPending}
      />
    </div>
  );
}