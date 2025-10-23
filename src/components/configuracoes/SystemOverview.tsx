import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Shield, Users, Utensils, DollarSign, MessageSquare, Table, ClipboardList, History, UserCog, ScanFace, Star } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const features = [
  { title: "Reconhecimento Facial", description: "Identificação instantânea de clientes na chegada e na cozinha para controle de preparo.", icon: ScanFace },
  { title: "Fidelidade por Pontos", description: "Acúmulo automático de pontos por pagamento de pedidos e resgate de prêmios.", icon: Star },
  { title: "Automação de Mensagens", description: "Envio automático de mensagens de boas-vindas, pós-pagamento e aniversário via webhook.", icon: MessageSquare },
  { title: "Gestão de Mesas e Pedidos", description: "Controle visual do salão, ocupação de mesas, pedidos abertos e fechamento de conta parcial/total.", icon: Table },
  { title: "Relatórios Financeiros", description: "Visão de faturamento, ticket médio e estatísticas de gorjetas por garçom.", icon: DollarSign },
  { title: "Cardápio Digital", description: "Menu público acessível via QR Code, permitindo que clientes adicionem itens ao pedido.", icon: ClipboardList },
];

const roles = [
  { 
    role: 'superadmin', 
    label: 'Super Admin', 
    description: 'Acesso total ao sistema, incluindo gerenciamento de usuários, configurações de integração (CompreFace, Webhook) e todas as operações.',
    permissions: ['Gerenciamento de Usuários', 'Configurações de Integração', 'Todas as Operações de Salão/Cozinha/Relatórios'],
    restrictions: [],
  },
  { 
    role: 'admin', 
    label: 'Admin', 
    description: 'Acesso administrativo completo, exceto gerenciamento de outros Super Admins e configurações críticas de infraestrutura.',
    permissions: ['Gerenciamento de Cardápio/Mesas/Cozinheiros', 'Aprovação de Solicitações', 'Relatórios', 'Configurações de Mensagens'],
    restrictions: ['Não pode gerenciar outros usuários (exceto perfis)', 'Não pode configurar o CompreFace'],
  },
  { 
    role: 'gerente', 
    label: 'Gerente', 
    description: 'Controle operacional e financeiro. Pode aprovar ações sensíveis e gerenciar o dia a dia do salão e cozinha.',
    permissions: ['Gerenciamento de Cardápio/Mesas/Cozinheiros', 'Aprovação de Solicitações', 'Relatórios', 'Fechamento do Dia'],
    restrictions: ['Não pode acessar Configurações de Integração/Sistema'],
  },
  { 
    role: 'balcao', 
    label: 'Balcão', 
    description: 'Focado na operação de mesas e pedidos. Requer aprovação para ações sensíveis (descontos, liberar mesa).',
    permissions: ['Salão (Ocupar/Editar Mesas)', 'Pedidos (Adicionar/Remover Itens)', 'Entregar Itens Sem Preparo', 'Visualizar Dashboard'],
    restrictions: ['Requer aprovação para descontos e liberar mesas', 'Não gerencia Cardápio/Cozinheiros/Relatórios'],
  },
  { 
    role: 'garcom', 
    label: 'Garçom', 
    description: 'Focado no atendimento e pedidos. Requer aprovação para ações sensíveis. Pode ver suas estatísticas de gorjeta.',
    permissions: ['Salão (Ocupar/Editar Mesas)', 'Pedidos (Adicionar/Remover Itens)', 'Entregar Itens Sem Preparo', 'Visualizar Gorjetas'],
    restrictions: ['Requer aprovação para descontos e liberar mesas', 'Não gerencia Cardápio/Cozinheiros/Relatórios'],
  },
  { 
    role: 'cozinha', 
    label: 'Cozinha', 
    description: 'Acesso ao painel Kanban para iniciar e finalizar o preparo de itens.',
    permissions: ['Painel da Cozinha (Kanban)'],
    restrictions: ['Acesso restrito apenas ao painel de preparo'],
  },
];

export function SystemOverview() {
  return (
    <div className="space-y-8">
      <Card className="bg-primary/10 border-primary/50">
        <CardHeader>
          <CardTitle className="text-3xl text-primary flex items-center gap-2">
            <Shield className="w-7 h-7" /> O Poder do Fidelize
          </CardTitle>
          <CardDescription>
            O Fidelize é uma plataforma completa de gestão de clientes e pedidos, focada em automação e reconhecimento facial.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map(feature => (
            <div key={feature.title} className="flex items-start p-3 bg-card rounded-lg shadow-sm">
              <feature.icon className="w-5 h-5 mt-1 mr-3 text-primary shrink-0" />
              <div>
                <h4 className="font-semibold">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold">Funções e Permissões de Usuário</h2>
      <p className="text-muted-foreground">Entenda o que cada função pode fazer no sistema.</p>

      <div className="space-y-6">
        {roles.map((role) => (
          <Card key={role.role}>
            <CardHeader className="bg-secondary/50 rounded-t-lg">
              <CardTitle className="text-xl flex items-center gap-2">
                <UserCog className="w-5 h-5" /> {role.label}
              </CardTitle>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-semibold mb-2 flex items-center text-green-600"><CheckCircle className="w-4 h-4 mr-2" /> Permissões Principais</h5>
                  <ul className="space-y-1 text-sm">
                    {role.permissions.map((p, i) => (
                      <li key={i} className="flex items-center text-foreground/80">
                        <CheckCircle className="w-3 h-3 mr-2 text-green-500 shrink-0" /> {p}
                      </li>
                    ))}
                  </ul>
                </div>
                {role.restrictions.length > 0 && (
                  <div>
                    <h5 className="font-semibold mb-2 flex items-center text-destructive"><XCircle className="w-4 h-4 mr-2" /> Restrições</h5>
                    <ul className="space-y-1 text-sm">
                      {role.restrictions.map((r, i) => (
                        <li key={i} className="flex items-center text-destructive/80">
                          <XCircle className="w-3 h-3 mr-2 text-destructive shrink-0" /> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}