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
  indicado_por?: { nome: string } | null;
  visitas: number;
  data_nascimento?: string | null;
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
  tipo: 'chegada' | 'pagamento' | 'geral' | 'aniversario';
  created_at: string;
};

export type UserSettings = {
  id: string;
  webhook_url: string | null;
  chegada_template_id: string | null;
  pagamento_template_id: string | null;
  aniversario_template_id?: string | null;
  aniversario_horario?: string | null;
  api_key: string | null;
  auto_add_item_enabled?: boolean;
  default_produto_id?: string | null;
  establishment_is_closed?: boolean;
  daily_report_phone_number?: string | null;
  auto_close_enabled?: boolean;
  auto_close_time?: string | null;
  menu_style?: string | null;
  preferred_camera_device_id?: string | null;
  compreface_url?: string | null;
  compreface_api_key?: string | null;
};

export type Pedido = {
  id: string;
  mesa_id: string | null;
  cliente_id: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  itens_pedido: ItemPedido[];
  acompanhantes?: { id: string; nome: string }[];
};

export type ItemPedido = {
  id: string;
  pedido_id: string;
  nome_produto: string;
  quantidade: number;
  preco: number | null;
  consumido_por_cliente_id?: string | null;
  desconto_percentual?: number | null;
  desconto_motivo?: string | null;
  status: 'pendente' | 'preparando' | 'entregue';
  requer_preparo: boolean;
  created_at: string;
  updated_at: string;
};

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  tipo: 'venda' | 'rodizio' | 'componente_rodizio';
  requer_preparo: boolean;
  created_at: string;
};

export type MessageLog = {
  id: string;
  created_at: string;
  status: 'sucesso' | 'falha';
  trigger_event: 'chegada' | 'pagamento' | 'fechamento_dia' | 'manual' | 'abertura_dia' | 'aniversario';
  error_message: string | null;
  webhook_response: Record<string, any> | null;
  cliente: { nome: string } | null;
  template: { nome: string } | null;
  delivery_status: 'pending' | 'delivered' | 'failed' | null;
};