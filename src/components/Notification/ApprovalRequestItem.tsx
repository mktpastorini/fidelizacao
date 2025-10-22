import { ApprovalRequest, UserRole } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Table, Tag, User, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ApprovalRequestItemProps = {
  request: ApprovalRequest;
  onProcess: (requestId: string, action: 'approve' | 'reject') => void;
  isProcessing: boolean;
};

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  gerente: 'Gerente',
  balcao: 'Balcão',
  garcom: 'Garçom',
  cozinha: 'Cozinha',
};

// Função auxiliar para obter o objeto de relacionamento, seja ele um objeto direto ou o primeiro elemento de um array
function getRelationshipObject<T>(data: T | T[] | null | undefined): T | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data.length > 0 ? data[0] : null;
  }
  return data;
}

export function ApprovalRequestItem({ request, onProcess, isProcessing }: ApprovalRequestItemProps) {
  
  // Adicionando log para debug
  console.log("Dados da Solicitação:", request);
  
  // Acessando dados do solicitante
  const requesterProfile = getRelationshipObject(request.requester);
  
  // Construindo o nome completo do solicitante
  const firstName = requesterProfile?.first_name || '';
  const lastName = requesterProfile?.last_name || '';
  const fullName = (firstName + ' ' + lastName).trim();
  
  // Fallback: Se o nome estiver vazio, usa o ID do usuário (truncado)
  const displayRequesterName = fullName || `ID: ${request.user_id.substring(0, 8)}...`;
  
  const requesterRole = roleLabels[request.requester_role] || 'Desconhecido';
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { locale: ptBR, addSuffix: true });

  let title = "Solicitação de Aprovação";
  let description = "";
  let IconComponent: React.ElementType = Clock;
  let iconColor = "text-yellow-500";

  // Acessando os dados da relação
  const mesa = getRelationshipObject(request.mesa);
  const itemPedido = getRelationshipObject(request.item_pedido);
  const mesaNumero = mesa?.numero;

  // Construindo a descrição detalhada
  const requesterDetail = `${displayRequesterName} (${requesterRole})`;

  switch (request.action_type) {
    case 'free_table':
      // Se o número da mesa não vier, usamos o target_id (que é o ID da mesa) como fallback na descrição
      const mesaDisplay = mesaNumero ? `Mesa ${mesaNumero}` : `Mesa ID: ${request.target_id.substring(0, 8)}...`;
      title = `Liberar Mesa ${mesaNumero || '?'}`;
      description = `${requesterDetail} solicitou liberar a mesa.`;
      IconComponent = Table;
      iconColor = "text-blue-500";
      break;
    case 'apply_discount':
      const itemNome = itemPedido?.nome_produto || 'Item do Pedido';
      const desconto = request.payload.desconto_percentual;
      const motivo = request.payload.desconto_motivo || 'N/A';
      
      title = `Desconto de ${desconto}% em ${itemNome}`;
      description = `${requesterDetail} solicitou um desconto de ${desconto}% no item "${itemNome}". Motivo: ${motivo}`;
      IconComponent = Tag;
      iconColor = "text-green-500";
      break;
  }

  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className={cn("p-2 rounded-full bg-secondary mr-3", iconColor)}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-semibold text-base">{title}</h5>
            <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-3">
        <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>Solicitado por: {displayRequesterName} ({requesterRole})</span>
        </div>
        <span>{timeAgo}</span>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onProcess(request.id, 'approve')}
          disabled={isProcessing}
        >
          {isProcessing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
          Aprovar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-destructive hover:bg-red-700 text-white"
          onClick={() => onProcess(request.id, 'reject')}
          disabled={isProcessing}
        >
          <XCircle className="w-4 h-4 mr-1" /> Rejeitar
        </Button>
      </div>
    </div>
  );
}