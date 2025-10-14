export type Filho = {
  id?: string;
  nome: string;
  idade: number | null;
};

export type Cliente = {
  id: string;
  nome: string;
  casado_com: string | null;
  cliente_desde: string;
  gostos: Record<string, any> | null;
  indicacoes: number;
  whatsapp: string | null;
  avatar_url: string | null;
  filhos: Filho[];
  created_at: string;
  indicado_por_id: string | null;
};

export type Mesa = {
  id: string;
  numero: number;
  capacidade: number;
  cliente_id: string | null;
  created_at: string;
  cliente: { id: string; nome: string } | null;
};

export type MessageTemplate = {
  id: string;
  nome: string;
  conteudo: string;
  tipo: 'chegada' | 'pagamento' | 'geral';
  created_at: string;
};

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  updated_at: string;
};

export type UserSettings = {
  id: string;
  webhook_url: string | null;
  chegada_template_id: string | null;
  pagamento_template_id: string | null;
};

export type Pedido = {
  id: string;
  mesa_id: string | null;
  cliente_id: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  itens_pedido: ItemPedido[];
};

export type ItemPedido = {
  id: string;
  pedido_id: string;
  nome_produto: string;
  quantidade: number;
  preco: number | null;
};

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  created_at: string;
};