// ... (imports e código anterior permanecem iguais)

const itemSchema = z.object({
  nome_produto: z.string().min(2, "O nome do produto é obrigatório."),
  quantidade: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
  preco: z.coerce.number(),
  consumido_por_cliente_id: z.string().uuid().nullable().optional(),
  status: z.enum(['pendente', 'preparando', 'entregue']),
  requer_preparo: z.boolean(),
});

// ... (funções fetch permanecem iguais)

export function PedidoModal({ isOpen, onOpenChange, mesa }: PedidoModalProps) {
  // ... (hooks e estados permanecem iguais)

  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: fetchProdutos,
    enabled: isOpen,
  });

  // ... (outros hooks e mutações permanecem iguais)

  const onSubmit = (values: z.infer<typeof itemSchema>) => {
    const produtoSelecionado = produtos?.find(p => p.nome === values.nome_produto);
    let requerPreparo = true;
    let status: 'pendente' | 'entregue' = 'pendente';

    if (produtoSelecionado) {
      if (produtoSelecionado.tipo === 'rodizio_especial') {
        // Produtos rodizio_especial não vão para cozinha e não requerem preparo
        requerPreparo = false;
        status = 'entregue';
      } else {
        requerPreparo = produtoSelecionado.requer_preparo ?? true;
        status = 'pendente';
      }
    }

    addItemMutation.mutate({ ...values, status, requer_preparo: requerPreparo });
  };

  // ... (restante do componente permanece igual)
}