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
  filhos: Filho[];
  created_at: string;
};

export type Mesa = {
  id: string;
  numero: number;
  capacidade: number;
  cliente_id: string | null;
  created_at: string;
};