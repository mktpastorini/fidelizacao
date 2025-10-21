import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Mesa, Pedido, ItemPedido, UserSettings } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { ClientArrivalModal } from "@/components/dashboard/ClientArrivalModal";
import { NewClientDialog } from "@/components/dashboard/NewClientDialog";
import { MesaCard } from "@/components/mesas/MesaCard";
import { PedidoModal } from "@/components/mesas/PedidoModal";
import { OcuparMesaDialog } from "@/components/mesas/OcuparMesaDialog";
import { UserPlus, Lock, Unlock, ScanFace, Users } from "lucide-react"; // Adicionado ScanFace e Users
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LiveRecognition } from "@/components/salao/LiveRecognition";
import { MultiLiveRecognition } from "@/components/salao/MultiLiveRecognition"; // Importando o novo componente

type Ocupante = { cliente: { id: string; nome: string } | null };
type MesaComOcupantes = Mesa & { ocupantes: Ocupante[] };
type PedidoAberto = Pedido & { itens_pedido: ItemPedido[] };

type SalaoData = {
  mesas: MesaComOcupantes[];
  pedidosAbertos: PedidoAberto[];
  clientes: Cliente[];
  settings: UserSettings | null;
};

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

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

  const { data: settings, error: settingsError } = await supabase.from("user_settings").select("*").eq("id", user!.id).single();
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
  const [isArrivalOpen, setIsArrivalOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isPedidoOpen, setIsPedidoOpen] = useState(false);
  const [isOcuparMesaOpen, setIsOcuparMesaOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [recognizedClient, setRecognizedClient] = useState<Cliente | null>(null);
  const [isMultiDetectionMode, setIsMultiDetectionMode] = useState(false); // Novo estado para alternar o modo

  const { data, isLoading } = useQuery({
    queryKey: ["salaoData"],
    queryFn: fetchSalaoData,
    refetchInterval: 30000,
  });

  const isClosed = data?.settings?.establishment_is_closed || false;
  const isCloseDayReady = !!data?.settings?.webhook_url && !!data?.settings?.daily_report_phone_number;

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
      if (!user) throw new Error("Usuário não autenticado");

      const { error: updateError } = await supabase.from("user_settings").update({ establishment_is_closed: false }).eq("id", user.id);
      if (updateError) throw updateError;

      const { error: functionError } = await supabase.functions.invoke('open-day');
      if (functionError) {
        showError(`Dia aberto, mas falha ao enviar notificação: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Estabelecimento aberto para um novo dia!");
    },
    onError: (error: Error) => showError(error.message),
  });

  const allocateTableMutation = useMutation({
    mutationFn: async ({ cliente, mesaId }: { cliente: Cliente; mesaId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      // 1. Tenta encontrar um pedido aberto existente para a mesa
      let pedidoId: string | null = null;
      const { data: existingPedido, error: existingPedidoError } = await supabase
        .from("pedidos")
        .select("id")
        .eq("mesa_id", mesaId)
        .eq("status", "aberto")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPedidoError) {
        console.warn("Erro ao buscar pedido existente:", existingPedidoError.message);
        // Não lançar erro aqui, apenas registrar e tentar criar um novo
      }

      if (existingPedido) {
        pedidoId = existingPedido.id;
        // Atualiza o pedido existente com o novo cliente principal e acompanhantes
        await supabase.from("pedidos").update({
          cliente_id: cliente.id,
          acompanhantes: [{ id: cliente.id, nome: cliente.nome }], // Apenas o cliente principal inicialmente
        }).eq("id", pedidoId);
      } else {
        // Se não houver pedido aberto, cria um novo
        const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
          mesa_id: mesaId,
          cliente_id: cliente.id,
          user_id: user.id,
          status: "aberto",
          acompanhantes: [{ id: cliente.id, nome: cliente.nome }],
        }).select("id").single();
        if (newPedidoError) throw newPedidoError;
        pedidoId = newPedido.id;
      }

      // 2. Atualiza a mesa com o cliente principal
      await supabase.from("mesas").update({ cliente_id: cliente.id }).eq("id", mesaId);
      
      // 3. Insere o cliente principal como ocupante da mesa
      // Primeiro, remove qualquer ocupante existente para garantir que o trigger seja disparado apenas para o novo
      await supabase.from("mesa_ocupantes").delete().eq("mesa_id", mesaId);
      await supabase.from("mesa_ocupantes").insert({
        mesa_id: mesaId,
        cliente_id: cliente.id,
        user_id: user.id,
      });

      const { error: functionError } = await supabase.functions.invoke('send-welcome-message', {
        body: { clientId: cliente.id, userId: user.id },
      });
      if (functionError) {
        showError(`Mesa alocada, mas falha ao enviar mensagem: ${functionError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      showSuccess("Cliente alocado à mesa com sucesso!");
      setIsArrivalOpen(false);
      setRecognizedClient(null);
    },
    onError: (error: Error) => showError(`Erro ao alocar mesa: ${error.message}`),
  });

  const addClientMutation = useMutation({
    mutationFn: async (newCliente: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { avatar_urls, ...clienteData } = newCliente;
      
      if (!avatar_urls || avatar_urls.length === 0) {
        throw new Error("É necessário pelo menos uma foto para o reconhecimento.");
      }
      
      const { error: rpcError, data: newClientId } = await supabase.rpc('create_client_with_referral', {
        p_user_id: user.id, p_nome: clienteData.nome, p_casado_com: clienteData.casado_com,
        p_whatsapp: clienteData.whatsapp, p_gostos: clienteData.gostos, p_avatar_url: clienteData.avatar_url,
        p_indicado_por_id: clienteData.indicado_por_id,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (!newClientId) throw new Error("Falha ao obter o ID do novo cliente após a criação.");

      try {
        if (clienteData.filhos && clienteData.filhos.length > 0) {
          const filhosData = clienteData.filhos.map((filho: any) => ({ ...filho, cliente_id: newClientId, user_id: user.id }));
          const { error: filhosError } = await supabase.from("filhos").insert(filhosData);
          if (filhosError) throw new Error(`Erro ao adicionar filhos: ${filhosError.message}`);
        }
        
        const { error: faceError } = await supabase.functions.invoke('add-face-examples', {
          body: { subject: newClientId, image_urls: avatar_urls }
        });
        if (faceError) throw faceError;

      } catch (error) {
        console.error("Erro durante o processo de pós-criação do cliente. Revertendo...", error);
        await supabase.from("clientes").delete().eq("id", newClientId);
        throw new Error(`O cadastro do cliente falhou durante o registro facial. A operação foi desfeita. Erro original: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salaoData"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Novo cliente cadastrado com sucesso!");
      setIsNewClientOpen(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const ocuparMesaMutation = useMutation({
    mutationFn: async ({ clientePrincipalId, acompanhanteIds, currentOccupantIds }: { clientePrincipalId: string, acompanhanteIds: string[], currentOccupantIds: string[] }) => {
      if (!selectedMesa) throw new Error("Nenhuma mesa selecionada");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");
  
      const todosNovosOcupantesIds = [clientePrincipalId, ...acompanhanteIds];
      const todosOcupantes = data?.clientes?.filter(c => todosNovosOcupantesIds.includes(c.id)) || [];
      const acompanhantesJson = todosOcupantes.map(c => ({ id: c.id, nome: c.nome }));
  
      // 1. Find or create the open pedido
      let pedidoId: string | null = null;
      const { data: existingPedido, error: existingPedidoError } = await supabase
        .from("pedidos")
        .select("id")
        .eq("mesa_id", selectedMesa.id)
        .eq("status", "aberto")
        .order("created_at", { ascending: false }) // Ordena para pegar o mais recente
        .limit(1) // Limita a 1 resultado
        .maybeSingle(); // Usa maybeSingle agora que limitamos a 1

      if (existingPedidoError) throw existingPedidoError;

      if (existingPedido) {
        pedidoId = existingPedido.id;
        // Update existing pedido's cliente_id and acompanhantes if necessary
        await supabase.from("pedidos").update({
          cliente_id: clientePrincipalId,
          acompanhantes: acompanhantesJson,
        }).eq("id", pedidoId);
      } else {
        // Create new pedido if none exists
        const { data: newPedido, error: newPedidoError } = await supabase.from("pedidos").insert({
          mesa_id: selectedMesa.id,
          cliente_id: clientePrincipalId,
          user_id: user.id,
          status: "aberto",
          acompanhantes: acompanhantesJson,
        }).select("id").single();
        if (newPedidoError) throw newPedidoError;
        pedidoId = newPedido.id;
      }

      // 2. Update the mesa's main client
      await supabase.from("mesas").update({ cliente_id: clientePrincipalId }).eq("id", selectedMesa.id);
  
      // 3. Manage mesa_ocupantes to trigger only for new additions
      const currentOccupantSet = new Set(currentOccupantIds);
      const newOccupantSet = new Set(todosNovosOcupantesIds);

      const occupantsToRemove = currentOccupantIds.filter(id => !newOccupantSet.has(id));
      const occupantsToAdd = todosNovosOcupantesIds.filter(id => !currentOccupantSet.has(id));

      if (occupantsToRemove.length > 0) {
        await supabase.from("mesa_ocupantes").delete().eq("mesa_id", selectedMesa.id).in("cliente_id", occupantsToRemove);
      }

      if (occupantsToAdd.length > 0) {
        const ocupantesDataToInsert = occupantsToAdd.map(clienteId => ({
          mesa_id: selectedMesa.id,
          cliente_id: clienteId,
          user_id: user.id,
        }));
        await supabase.from("mesa_ocupantes").insert(ocupantesDataToInsert);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["salaoData"] }); // Invalidate salaoData to reflect changes
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
    if ((recognizedClient?.id === cliente.id && isArrivalOpen) || isClosed) return;
    
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div tabIndex={0}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={closeDayMutation.isPending || !isCloseDayReady}>
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
                  </div>
                </TooltipTrigger>
                {!isCloseDayReady && (
                  <TooltipContent>
                    <p>Configure a URL do Webhook e o Nº para Relatório nas Configurações.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          <Button onClick={() => setIsNewClientOpen(true)} disabled={isClosed}><UserPlus className="w-4 h-4 mr-2" />Novo Cliente</Button>
          <Button 
            variant="outline" 
            onClick={() => setIsMultiDetectionMode(prev => !prev)} 
            disabled={isClosed}
          >
            {isMultiDetectionMode ? <ScanFace className="w-4 h-4 mr-2" /> : <Users className="w-4 h-4 mr-2" />}
            {isMultiDetectionMode ? "Modo Único" : "Multi-Detecção"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1">
          {isMultiDetectionMode ? (
            <MultiLiveRecognition />
          ) : (
            <LiveRecognition onClientRecognized={handleClientRecognized} />
          )}
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {mesasComPedidos?.map(mesa => (
            <MesaCard key={mesa.id} mesa={mesa} ocupantesCount={mesa.ocupantes.length} onClick={() => handleMesaClick(mesa)} />
          ))}
        </div>
      </div>

      <NewClientDialog isOpen={isNewClientOpen} onOpenChange={setIsNewClientOpen} clientes={data?.clientes || []} onSubmit={addClientMutation.mutate} isSubmitting={addClientMutation.isPending} />
      <ClientArrivalModal isOpen={isArrivalOpen} onOpenChange={setIsArrivalOpen} cliente={recognizedClient} mesasLivres={mesasLivres} onAllocateTable={(mesaId) => { if (recognizedClient) { allocateTableMutation.mutate({ cliente: recognizedClient, mesaId }); } }} isAllocating={allocateTableMutation.isPending} />
      <PedidoModal isOpen={isPedidoOpen} onOpenChange={setIsPedidoOpen} mesa={selectedMesa} />
      <OcuparMesaDialog isOpen={isOcuparMesaOpen} onOpenChange={setIsOcuparMesaOpen} mesa={selectedMesa} clientes={data?.clientes || []} onSubmit={(clientePrincipalId, acompanhanteIds, currentOccupantIds) => ocuparMesaMutation.mutate({ clientePrincipalId, acompanhanteIds, currentOccupantIds })} isSubmitting={ocuparMesaMutation.isPending} />
    </div>
  );
}