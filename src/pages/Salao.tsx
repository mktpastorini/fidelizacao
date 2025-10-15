import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Mesa, Pedido, ItemPedido } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { ClientArrivalModal } from "@/components/dashboard/ClientArrivalModal";
import { FacialRecognitionDialog } from "@/components/dashboard/FacialRecognitionDialog";
import { NewClientDialog } from "@/components/dashboard/NewClientDialog";
import { MesaCard } from "@/components/mesas/MesaCard";
import { PedidoModal } from "@/components/mesas/PedidoModal";
import { OcuparMesaDialog } from "@/components/mesas/OcuparMesaDialog";
import { Users, DollarSign, ChefHat, Camera, UserPlus } from "lucide-react";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";

type Ocupante = { cliente: { id: string; nome: string } | null };
type MesaComOcupantes = Mesa & { ocupantes: Ocupante[] };
type PedidoAberto = Pedido & { itens_pedido: ItemPedido[] };

type SalaoData = {
  mesas: MesaComOcupantes[];
  pedidosAbertos: PedidoAberto[];
  clientes: Cliente[];
  stats: {
    revenue_today: number;
    kitchen_orders: number;
  };
};

async function fetchSalaoData(): Promise<SalaoData> {
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

  const { data: revenueData, error: revenueError } = await supabase.rpc('get_financial_stats_today');
  if (revenueError) throw new Error(revenueError.message);

  const { count: kitchenCount, error: kitchenError } = await supabase
    .from("itens_pedido")
    .select("*", { count: 'exact', head: true })
    .in("status", ["pendente", "preparando"]);
  if (kitchenError) throw new Error(kitchenError.message);

  return {
    mesas: mesas || [],
    pedidosAbertos: pedidosAbertos || [],
    clientes: clientes || [],
    stats: {
      revenue_today: revenueData.revenue_today || 0,
      kitchen_orders: kitchenCount || 0,
    },
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
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const mesasComPedidos = data?.mesas.map(mesa => {
    const pedido = data.pedidosAbertos.find(p => p.mesa_id === mesa.id);
    return { ...mesa, pedido };
  });

  const mesasOcupadas = data?.mesas.filter(m => m.cliente_id).length || 0;
  const mesasLivres = data?.mesas.filter(m => !m.cliente_id) || [];

  const handleMesaClick = (mesa: Mesa) => {
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

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }
  
  if (data?.clientes.length === 0) {
    return <WelcomeCard />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Visão do Salão</h1>
          <p className="text-muted-foreground mt-1">Acompanhe suas mesas e o movimento em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsRecognitionOpen(true)}><Camera className="w-4 h-4 mr-2" />Analisar Rosto</Button>
          <Button onClick={() => setIsNewClientOpen(true)}><UserPlus className="w-4 h-4 mr-2" />Novo Cliente</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Faturamento do Dia" value={formatCurrency(data?.stats.revenue_today || 0)} icon={DollarSign} />
        <StatCard title="Mesas Ocupadas" value={`${mesasOcupadas} de ${data?.mesas.length || 0}`} icon={Users} />
        <StatCard title="Pedidos na Cozinha" value={data?.stats.kitchen_orders || 0} icon={ChefHat} />
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