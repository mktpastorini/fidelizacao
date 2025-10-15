import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Mesa, Pedido, ItemPedido } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { ClientArrivalModal } from "@/components/dashboard/ClientArrivalModal";
import { FacialRecognitionDialog } from "@/components/dashboard/FacialRecognitionDialog";
import { NewClientDialog } from "@/components/dashboard/NewClientDialog";
import { MesaCard } from "@/components/mesas/MesaCard";
import { PedidoModal } from "@/components/mesas/PedidoModal";
import { OcuparMesaDialog } from "@/components/mesas/OcuparMesaDialog";
import { Camera, UserPlus } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";

type Ocupante = { cliente: { id: string; nome: string } | null };
type MesaComOcupantes = Mesa & { ocupantes: Ocupante[] };
type PedidoAberto = Pedido & { itens_pedido: ItemPedido[] };

type SalaoData = {
  mesas: MesaComOcupantes[];
  pedidosAbertos: PedidoAberto[];
  clientes: Cliente[];
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

  return {
    mesas: mesas || [],
    pedidosAbertos: pedidosAbertos || [],
    clientes: clientes || [],
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

  const addClienteMutation = useMutation({
    mutationFn: async (newCliente: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { error: rpcError, data: newClientId } = await supabase.rpc('create_client_with_referral', {
        p_user_id: user.id, p_nome: newCliente.nome, p_casado_com: newCliente.casado_com,
        p_whatsapp: newCliente.whatsapp, p_gostos: newCliente.gostos, p_avatar_url: newCliente.avatar_url,
        p_indicado_por_id: newCliente.indicado_por_id,
      });
      if (rpcError) throw new Error(rpcError.message);
      
      if (newCliente.avatar_url) {
        const { error: faceError } = await supabase.functions.invoke('register-face', {
          body: { cliente_id: newClientId, image_url: newCliente.avatar_url },
        });
        if (faceError) showError(`Cliente criado, mas falha ao registrar o rosto: ${faceError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["clientes_list"] });
      showSuccess("Cliente adicionado com sucesso!");
      setIsNewClientOpen(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const alocarMesaMutation = useMutation({
    mutationFn: async (mesaId: string) => {
      if (!recognizedClient) throw new Error("Nenhum cliente reconhecido.");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      await supabase.from("mesas").update({ cliente_id: recognizedClient.id }).eq("id", mesaId);
      await supabase.from("mesa_ocupantes").insert({ mesa_id: mesaId, cliente_id: recognizedClient.id, user_id: user.id });
      
      const { error: functionError } = await supabase.functions.invoke('send-welcome-message', { body: { clientId: recognizedClient.id, userId: user.id } });
      if (functionError) showError(`Mesa alocada, mas falha ao enviar webhook: ${functionError.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Cliente alocado à mesa com sucesso!");
      setIsArrivalOpen(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const ocuparMesaMutation = useMutation({
    mutationFn: async ({ clientePrincipalId, acompanhanteIds }: { clientePrincipalId: string, acompanhanteIds: string[] }) => {
      if (!selectedMesa) throw new Error("Nenhuma mesa selecionada");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");
  
      await supabase.from("mesas").update({ cliente_id: clientePrincipalId }).eq("id", selectedMesa.id);
  
      await supabase.from("mesa_ocupantes").delete().eq("mesa_id", selectedMesa.id);
      const todosOcupantes = [clientePrincipalId, ...acompanhanteIds];
      const ocupantesData = todosOcupantes.map(clienteId => ({
        mesa_id: selectedMesa.id,
        cliente_id: clienteId,
        user_id: user.id,
      }));
      await supabase.from("mesa_ocupantes").insert(ocupantesData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Mesa ocupada/atualizada com sucesso!");
      setIsOcuparMesaOpen(false);
    },
    onError: (err: Error) => showError(err.message),
  });

  const mesasComPedidos = data?.mesas.map(mesa => {
    const pedido = data.pedidosAbertos.find(p => p.mesa_id === mesa.id);
    return { ...mesa, pedido };
  });

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

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/3" />
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {mesasComPedidos?.map(mesa => (
          <MesaCard key={mesa.id} mesa={mesa} onClick={() => handleMesaClick(mesa)} />
        ))}
      </div>

      <FacialRecognitionDialog isOpen={isRecognitionOpen} onOpenChange={setIsRecognitionOpen} onClientRecognized={handleClientRecognized} onNewClient={() => setIsNewClientOpen(true)} />
      <NewClientDialog isOpen={isNewClientOpen} onOpenChange={setIsNewClientOpen} clientes={data?.clientes || []} onSubmit={addClienteMutation.mutate} isSubmitting={addClienteMutation.isPending} />
      <ClientArrivalModal isOpen={isArrivalOpen} onOpenChange={setIsArrivalOpen} cliente={recognizedClient} mesasLivres={mesasLivres} onAllocateTable={alocarMesaMutation.mutate} isAllocating={alocarMesaMutation.isPending} />
      <PedidoModal isOpen={isPedidoOpen} onOpenChange={setIsPedidoOpen} mesa={selectedMesa} />
      <OcuparMesaDialog isOpen={isOcuparMesaOpen} onOpenChange={setIsOcuparMesaOpen} mesa={selectedMesa} clientes={data?.clientes || []} onSubmit={ocuparMesaMutation.mutate} isSubmitting={ocuparMesaMutation.isPending} />
    </div>
  );
}