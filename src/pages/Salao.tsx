import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Mesa, Pedido, ItemPedido, UserSettings } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { ClientArrivalModal } from "@/components/dashboard/ClientArrivalModal";
import { FacialRecognitionDialog } from "@/components/dashboard/FacialRecognitionDialog";
import { NewClientDialog } from "@/components/dashboard/NewClientDialog";
import { MesaCard } from "@/components/mesas/MesaCard";
import { PedidoModal } from "@/components/mesas/PedidoModal";
import { OcuparMesaDialog } from "@/components/mesas/OcuparMesaDialog";
import { Camera, UserPlus, Lock, Unlock } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Ocupante = { cliente: { id: string; nome: string } | null };
type MesaComOcupantes = Mesa & { ocupantes: Ocupante[] };
type PedidoAberto = Pedido & { itens_pedido: ItemPedido[] };

type SalaoData = {
  mesas: MesaComOcupantes[];
  pedidosAbertos: PedidoAberto[];
  clientes: Cliente[];
  settings: UserSettings | null;
};

async function fetchSalaoData(): Promise<SalaoData> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: mesas, error: mesasError } = await supabase
    .from("mesas")
    .select("*, cliente:clientes(id, nome), ocupantes:mesa_ocupantes(cliente:clientes(id, nome))")
    .order("numero", { ascending: true });
  if (mesasError) throw new Error(mesasError.message);

  const { data: pedidosAbertos, error: pedidosError } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("status", "aberto");
  if (pedidosError) throw new Error(pedidosError.message);

  const { data: clientes, error: clientesError } = await supabase.from("clientes").select("*, filhos(*)");
  if (clientesError) throw new Error(clientesError.message);

  const { data: settings, error: settingsError } = await supabase.from("user_settings").select("establishment_is_closed").eq("id", user!.id).single();
  if (settingsError && settingsError.code !== 'PGRST116') throw new Error(settingsError.message);

  return {
    mesas: mesas || [],
    pedidosAbertos: pedidosAbertos || [],
    clientes: clientes || [],
    settings,
  };
}

export default function SalaoPage() {
  const queryClient = useQueryClient();
  const [isRecognitionOpen, setIsRecognitionOpen] = useState(false);
  const [isArrivalOpen, setIsArrivalOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isPedidoOpen, setIsPedidoOpen] = useState(false);
  const [isOcuparMesaOpen, setIsOcuparMesaOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [recognizedClient, setRecognizedClient] = useState<Cliente | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["salaoData"],
    queryFn: fetchSalaoData,
    refetchInterval: 30000,
  });

  const isClosed = data?.settings?.establishment_is_closed || false;

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('close-day');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Dia fechado com sucesso e relatório enviado!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const openDayMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_settings").update({ establishment_is_closed: false }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Estabelecimento aberto para um novo dia!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const mesasComPedidos = data?.mesas.map(mesa => {
    const pedido = data.pedidosAbertos.find(p => p.mesa_id === mesa.id);
    return { ...mesa, pedido };
  });

  const mesasLivres = data?.mesas.filter(m => !m.cliente_id) || [];

  const handleMesaClick = (mesa: Mesa) => {
    if (isClosed && !mesa.cliente_id) {
      showError("O estabelecimento está fechado. Não é possível ocupar novas mesas.");
      return;
    }
    setSelectedMesa(mesa);
    if (mesa.cliente_id) {
      setIsPedidoOpen(true);
    } else {
      setIsOcuparMesaOpen(true);
    }
  };

  const handleClientRecognized = (cliente: Cliente) => {
    setRecognizedClient(cliente);
    setIsArrivalOpen(true);
  };

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }
  
  if (data?.clientes.length === 0) {
    return <WelcomeCard />;
  }

  return (
    <div className="p-6 space-y-6">
      {isClosed && (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Estabelecimento Fechado</AlertTitle>
          <AlertDescription>
            Nenhuma nova alocação de mesa ou pedido pode ser feito. Para reabrir, clique em "Abrir Dia".
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Visão do Salão</h1>
          <p className="text-muted-foreground mt-1">Acompanhe suas mesas e o movimento em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          {isClosed ? (
            <Button onClick={() => openDayMutation.mutate()} disabled={openDayMutation.isPending}>
              <Unlock className="w-4 h-4 mr-2" /> {openDayMutation.isPending ? "Abrindo..." : "Abrir Dia"}
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={closeDayMutation.isPending}>
                  <Lock className="w-4 h-4 mr-2" /> {closeDayMutation.isPending ? "Fechando..." : "Fechar o Dia"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Fechamento do Dia?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá bloquear novas operações e enviar o relatório diário para o número configurado. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => closeDayMutation.mutate()}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => setIsRecognitionOpen(true)} disabled={isClosed}><Camera className="w-4 h-4 mr-2" />Analisar Rosto</Button>
          <Button onClick={() => setIsNewClientOpen(true)} disabled={isClosed}><UserPlus className="w-4 h-4 mr-2" />Novo Cliente</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {mesasComPedidos?.map(mesa => (
          <MesaCard key={mesa.id} mesa={mesa} onClick={() => handleMesaClick(mesa)} />
        ))}
      </div>

      <FacialRecognitionDialog isOpen={isRecognitionOpen} onOpenChange={setIsRecognitionOpen} onClientRecognized={handleClientRecognized} onNewClient={() => setIsNewClientOpen(true)} />
      <NewClientDialog isOpen={isNewClientOpen} onOpenChange={setIsNewClientOpen} clientes={data?.clientes || []} onSubmit={() => {}} isSubmitting={false} />
      <ClientArrivalModal isOpen={isArrivalOpen} onOpenChange={setIsArrivalOpen} cliente={recognizedClient} mesasLivres={mesasLivres} onAllocateTable={() => {}} isAllocating={false} />
      <PedidoModal isOpen={isPedidoOpen} onOpenChange={setIsPedidoOpen} mesa={selectedMesa} />
      <OcuparMesaDialog isOpen={isOcuparMesaOpen} onOpenChange={setIsOcuparMesaOpen} mesa={selectedMesa} clientes={data?.clientes || []} onSubmit={() => {}} isSubmitting={false} />
    </div>
  );
}