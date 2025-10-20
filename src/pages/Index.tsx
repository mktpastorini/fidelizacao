"use client";

import { useState } from "react";
import ClientesPage from "./clientes";
import { FacialRecognitionDialog } from "@/components/dashboard/FacialRecognitionDialog";
import { Dialog } from "@/components/ui/dialog";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

export default function Index() {
  const [isFacialRecognitionOpen, setIsFacialRecognitionOpen] = useState(false);
  const [isCadastroOpen, setIsCadastroOpen] = useState(false);

  const queryClient = useQueryClient();

  const addClienteMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      showSuccess("Cliente adicionado com sucesso!");
      setIsCadastroOpen(false);
    },
    onError: (error: Error) => showError(error.message),
  });

  return (
    <>
      <button
        className="fixed bottom-6 right-6 bg-primary text-white rounded-full p-4 shadow-lg hover:bg-primary-dark transition"
        onClick={() => setIsFacialRecognitionOpen(true)}
      >
        Abrir Reconhecimento Facial
      </button>

      <FacialRecognitionDialog
        isOpen={isFacialRecognitionOpen}
        onOpenChange={setIsFacialRecognitionOpen}
        onClientRecognized={(cliente) => {
          alert(`Cliente reconhecido: ${cliente.nome}`);
          setIsFacialRecognitionOpen(false);
        }}
        onNewClientRequested={() => {
          setIsFacialRecognitionOpen(false);
          setIsCadastroOpen(true);
        }}
      />

      <Dialog open={isCadastroOpen} onOpenChange={setIsCadastroOpen}>
        <Dialog.Content className="max-w-2xl max-h-[80vh] overflow-y-auto p-4">
          <Dialog.Header>
            <Dialog.Title>Cadastrar Novo Cliente</Dialog.Title>
            <Dialog.Description>
              Adicione uma ou mais fotos para o reconhecimento e preencha as informações.
            </Dialog.Description>
          </Dialog.Header>
          <ClienteForm 
            onSubmit={addClienteMutation.mutate} 
            isSubmitting={addClienteMutation.isPending} 
            clientes={[]} 
          />
        </Dialog.Content>
      </Dialog>

      <ClientesPage />
    </>
  );
}