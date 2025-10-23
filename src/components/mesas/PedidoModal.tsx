/* No trecho do closeOrderMutation, ajustar para que a gorjeta total seja paga apenas no fechamento total pelo cliente principal */

const closeOrderMutation = useMutation({
  mutationFn: async () => {
    if (!pedido || !mesa || !ocupantes) throw new Error("Pedido, mesa ou ocupantes não encontrados.");
    if (tipEnabled && !selectedGarcomId) throw new Error("Selecione o garçom para aplicar a gorjeta.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    // Se o cliente principal está pagando a conta total, gorjeta é total
    // Caso contrário, gorjeta é individual (calculada no pagamento parcial)
    // Aqui assumimos que o fechamento total é feito pelo cliente principal
    // Portanto, gorjeta total é aplicada

    // Atualiza o pedido aberto com a gorjeta e o garçom antes de fechar
    const { error: updateError } = await supabase.from("pedidos")
      .update({ gorjeta_valor: tipEnabled ? subtotalItens * 0.1 : 0, garcom_id: selectedGarcomId })
      .eq("id", pedido.id);
    if (updateError) throw updateError;

    // 2. Chama a função RPC para fechar o pedido e liberar a mesa
    const { error: rpcError } = await supabase.rpc('finalizar_pagamento_total', {
      p_pedido_id: pedido.id,
      p_mesa_id: mesa.id,
    });
    if (rpcError) throw rpcError;

    // 3. Envia confirmação de pagamento (se houver cliente principal)
    if (pedido.cliente_id) {
      const { error: functionError } = await supabase.functions.invoke('send-payment-confirmation', { 
        body: { pedidoId: pedido.id, userId: user.id } 
      });
      if (functionError) showError(`Conta fechada, mas falha ao enviar notificação: ${functionError.message}`);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["pedidoAberto", mesa?.id] });
    queryClient.invalidateQueries({ queryKey: ["mesas"] });
    queryClient.invalidateQueries({ queryKey: ["salaoData"] });
    queryClient.invalidateQueries({ queryKey: ["historicoCliente"] });
    queryClient.invalidateQueries({ queryKey: ["clientes"] });
    queryClient.invalidateQueries({ queryKey: ["pendingOrderItems"] });
    queryClient.invalidateQueries({ queryKey: ["tipStats"] }); // Invalida as estatísticas de gorjeta
    showSuccess("Conta fechada com sucesso!");
    onOpenChange(false);
  },
  onError: (error: Error) => showError(error.message),
});