import { ApprovalRequest, UserRole } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Table, Tag, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ApprovalRequestCardProps = {
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

export function ApprovalRequestCard({ request, onProcess, isProcessing }: ApprovalRequestCardProps) {
  const requesterName = request.requester?.first_name || 'Usuário';
  const requesterRole = roleLabels[request.requester_role] || 'Desconhecido';
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { locale: ptBR, addSuffix: true });

  let title = "Solicitação de Aprovação";
  let description = "";
  let icon: React.ElementType = Clock;
  let iconColor = "text-yellow-500";

  switch (request.action_type) {
    case 'free_table':
      title = `Liberar Mesa ${request.mesa?.numero || '?'}`;
      description = `Solicitado liberar a mesa.`;
      icon = Table;
      iconColor = "text-blue-500";
      break;
    case 'apply_discount':
      title = `Desconto de ${request.payload.desconto_percentual}%`;
      description = `Item: ${request.item_pedido?.nome_produto || 'Item do Pedido'}. Motivo: ${request.payload.desconto_motivo || 'N/A'}`;
      icon = Tag;
      iconColor = "text-green-500";
      break;
  }

  return (
    <div className="p-3 border rounded-lg bg-card shadow-sm space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className={cn("p-2 rounded-full bg-secondary mr-3", iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-semibold text-sm">{title}</h5>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground flex justify-between items-center border-t pt-2">
        <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>{requesterName} ({requesterRole})</span>
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
          <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
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