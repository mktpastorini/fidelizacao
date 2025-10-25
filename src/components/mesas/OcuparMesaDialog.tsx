import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Cliente, Mesa } from "@/types/supabase";
import { Check, ChevronsUpDown, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClienteForm } from "../clientes/ClienteForm";
import { showError, showSuccess } from "@/utils/toast";
import { useSuperadminId } from "@/hooks/useSuperadminId";

type OcuparMesaDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mesa: Mesa | null;
  clientes: Cliente[];
  onSubmit: (clientePrincipalId: string, acompanhanteIds: string[], currentOccupantIds: string[]) => void;
  isSubmitting: boolean;
};

async function fetchOcupantes(mesaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("mesa_ocupantes")
    .select("cliente_id")
    .eq("mesa_id", mesaId);
  if (error) throw error;
  return data.map(o => o.cliente_id);
}

export function OcuparMesaDialog({
  isOpen,
  onOpenChange,
  mesa,
  clientes,
  onSubmit,
  isSubmitting,
}: OcuparMesaDialogProps) {
  const queryClient = useQueryClient();
  const { superadminId } = useSuperadminId();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isNewCompanionOpen, setIsNewCompanionOpen] = useState(false);
  const [clientePrincipalId, setClientePrincipalId] = useState<string | null>(null);
  const [acompanhanteIds, setAcompanhanteIds] = useState<string[]>([]);

  const { data: ocupantesAtuais, isLoading: isLoadingOcupantes } = useQuery({
    queryKey: ["ocupantes", mesa?.id],
    queryFn: () => fetchOcupantes(mesa!.id),
    enabled: isOpen && !!mesa?.id, // Enable if dialog is open and mesa exists
    initialData: [], // Provide initial data to avoid undefined during first render
  });

  // Garante que ocupantesAtuais é um array vazio se for undefined
  const currentOccupants = ocupantesAtuais || [];

  useEffect(() => {
    if (isOpen && mesa?.cliente_id) {
      setClientePrincipalId(mesa.cliente_id);
      // Filter out the main client from acompanhantes if it's already in currentOccupants
      setAcompanhanteIds(currentOccupants.filter(id => id !== mesa.cliente_id));
    } else if (isOpen && !mesa?.cliente_id) {
      // If mesa is free, reset selections
      setClientePrincipalId(null);
      setAcompanhanteIds([]);
    }
  }, [isOpen, mesa, currentOccupants]); // Dependência atualizada para currentOccupants

  const addCompanionMutation = useMutation({
    mutationFn: async (newCliente: any) => {
      if (!superadminId) throw new Error("ID do Super Admin não encontrado.");

      const { error: rpcError, data: newClientId } = await supabase.rpc('create_client_with_referral', {
        p_user_id: superadminId, p_nome: newCliente.nome, p_casado_com: null,
        p_whatsapp: newCliente.whatsapp, p_gostos: null, p_avatar_url: newCliente.avatar_url,
        p_indicado_por_id: null,
      });
      if (rpcError) throw new Error(rpcError.message);
      
      const { data: newClient, error: selectError } = await supabase.from('clientes').select('*, filhos(*)').eq('id', newClientId).single();
      if (selectError) throw new Error(selectError.message);
      return newClient;
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["clientes_list"] });
      setAcompanhanteIds(prev => [...prev, newClient.id]);
      showSuccess(`${newClient.nome} cadastrado e adicionado à mesa!`);
      setIsNewCompanionOpen(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  const ocupantesCount = (clientePrincipalId ? 1 : 0) + acompanhanteIds.length;
  const capacidadeExcedida = mesa ? ocupantesCount > mesa.capacidade : false;

  const clientesDisponiveis = useMemo(() => {
    return clientes.filter(c => c.id !== clientePrincipalId && !acompanhanteIds.includes(c.id));
  }, [clientes, clientePrincipalId, acompanhanteIds]);

  const handleSubmit = () => {
    if (clientePrincipalId) {
      onSubmit(clientePrincipalId, acompanhanteIds, currentOccupants); // Pass currentOccupants
    }
  };

  const handleClose = () => {
    setClientePrincipalId(null);
    setAcompanhanteIds([]);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mesa?.cliente_id ? `Editando Ocupantes da Mesa ${mesa?.numero}` : `Ocupar Mesa ${mesa?.numero}`}</DialogTitle>
            <DialogDescription>Selecione o cliente principal e adicione os acompanhantes.</DialogDescription>
          </DialogHeader>
          {isLoadingOcupantes ? <p>Carregando ocupantes...</p> : (
            <div className="py-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Cliente Principal (Responsável)</label>
                <Select onValueChange={setClientePrincipalId} value={clientePrincipalId || ""}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o cliente principal" /></SelectTrigger>
                  <SelectContent>{clientes.map((cliente) => (<SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Acompanhantes</label>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between mt-1">
                      {acompanhanteIds.length > 0 ? `${acompanhanteIds.length} acompanhante(s)` : "Adicionar acompanhantes"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clientesDisponiveis.map((cliente) => (
                            <CommandItem value={cliente.nome} key={cliente.id} onSelect={() => setAcompanhanteIds(prev => [...prev, cliente.id])}>
                              <UserPlus className="mr-2 h-4 w-4" />{cliente.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="flex flex-wrap gap-1 mt-2">
                  {acompanhanteIds.map(id => {
                    const cliente = clientes.find(c => c.id === id);
                    return (<Badge key={id} variant="secondary">{cliente?.nome}<button onClick={() => setAcompanhanteIds(ids => ids.filter(i => i !== id))} className="ml-1"><X className="h-3 w-3" /></button></Badge>);
                  })}
                </div>
                <Button variant="link" size="sm" className="p-0 h-auto mt-2" onClick={() => setIsNewCompanionOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1" /> Cadastrar novo acompanhante
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Capacidade: {mesa?.capacidade} | Ocupantes: {ocupantesCount}
                {capacidadeExcedida && <span className="text-destructive font-semibold ml-2">Capacidade excedida!</span>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!clientePrincipalId || isSubmitting || capacidadeExcedida}>
              {isSubmitting ? "Salvando..." : "Confirmar Ocupação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewCompanionOpen} onOpenChange={setIsNewCompanionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Acompanhante</DialogTitle>
            <DialogDescription>Preencha os dados do novo cliente. Ele será adicionado à mesa automaticamente.</DialogDescription>
          </DialogHeader>
          <ClienteForm
            mode="quick"
            onSubmit={(values) => addCompanionMutation.mutate(values)}
            isSubmitting={addCompanionMutation.isPending}
            clientes={clientes}
            isEditing={false}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}