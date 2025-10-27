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
  pontos: number; // NOVO CAMPO
  address_street?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_zip?: string | null;
  address_complement?: string | null;
};

export type Cozinheiro = {
  id: string;
  user_id: string | null;
  nome: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
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
  tipo: 'chegada' | 'pagamento' | 'geral' | 'aniversario' | 'delivery_confirmed' | 'delivery_in_preparation' | 'delivery_ready' | 'delivery_out_for_delivery';
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
  delivery_confirmed_template_id?: string | null;
  delivery_in_preparation_template_id?: string | null;
  delivery_ready_template_id?: string | null;
  delivery_out_for_delivery_template_id?: string | null;
  multi_detection_interval?: number;
  multi_detection_confidence?: number;
  exit_alert_phrase?: string | null; // Nova configuração
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
  gorjeta_valor?: number | null; // NOVO CAMPO
  garcom_id?: string | null; // NOVO CAMPO
  order_type: 'SALAO' | 'IFOOD' | 'DELIVERY';
  ifood_order_id: string | null;
  delivery_details: any | null;
  delivery_status: 'awaiting_confirmation' | 'CONFIRMED' | 'in_preparation' | 'ready_for_delivery' | 'out_for_delivery' | 'delivered' | 'cancelled' | null;
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
  status: 'pendente' | 'preparando' | 'entregue' | 'cancelado';
  requer_preparo: boolean;
  created_at: string;
  updated_at: string;
  cozinheiro_id: string | null;
  cozinheiro?: { nome: string } | null; // NOVO CAMPO DE RELAÇÃO
  hora_inicio_preparo: string | null; // NOVO CAMPO
  hora_entrega: string | null; // NOVO CAMPO
};

export type Categoria = {
  id: string;
  user_id: string;
  nome: string;
  created_at: string;
};

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  tipo: 'venda' | 'rodizio' | 'componente_rodizio';
  requer_preparo: boolean;
  created_at: string;
  categoria_id: string | null;
  imagem_url: string | null;
  categoria?: Categoria | null;
  // Inventory fields
  estoque_atual: number;
  alerta_estoque_baixo: number;
  valor_compra: number | null;
  mostrar_no_menu?: boolean;
  pontos_resgate: number | null; // NOVO CAMPO
};

// Tipos para o sistema de aprovação
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalActionType = 'free_table' | 'apply_discount';

export type ApprovalRequest = {
  id: string;
  user_id: string;
  requester_role: UserRole;
  action_type: ApprovalActionType;
  target_id: string;
  payload: Record<string, any>;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  
  // Novas colunas FK para PostgREST
  mesa_id_fk: string | null;
  item_pedido_id_fk: string | null;

  // Relações para facilitar o frontend (retornam arrays devido ao PostgREST)
  requester?: { first_name: string | null; last_name: string | null; role: UserRole } | null;
  mesa?: { numero: number }[] | null; // Alterado para array
  item_pedido?: ItemPedido[] | null; // Alterado para array
};

export type UserRole = 'superadmin' | 'admin' | 'gerente' | 'balcao' | 'garcom' | 'cozinha';

export type StaffProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
};

export type LowStockProduct = {
  id: string;
  nome: string;
  estoque_atual: number;
  alerta_estoque_baixo: number;
};