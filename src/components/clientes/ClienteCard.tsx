import { Cliente } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Phone, Heart, Users, ThumbsUp, Trash2, Edit, Eye, User } from "lucide-react";
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ClienteCardProps = {
  cliente: Cliente;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const InfoBadge = ({ icon: Icon, text, className }: { icon: React.ElementType, text: string | number, className?: string }) => (
  <div className={`flex items-center text-sm ${className}`}>
    <Icon className="w-4 h-4 mr-2" />
    <span>{text}</span>
  </div>
);

export function ClienteCard({ cliente, onView, onEdit, onDelete }: ClienteCardProps) {
  const tempoCliente = formatDistanceToNowStrict(new Date(cliente.cliente_desde), { locale: ptBR, addSuffix: true });

  return (
    <Card className="flex flex-col justify-between shadow-lg">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={cliente.avatar_url || undefined} />
            <AvatarFallback>
              <User className="h-8 w-8 text-gray-400" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{cliente.nome}</h3>
            <p className="text-xs text-gray-500">Cliente {tempoCliente}</p>
          </div>
        </div>
        
        <div className="space-y-2 text-gray-600 border-t pt-3">
          {cliente.whatsapp && <InfoBadge icon={Phone} text={cliente.whatsapp} />}
          {cliente.casado_com && <InfoBadge icon={Heart} text={`Casado(a) com ${cliente.casado_com}`} />}
          {cliente.filhos && cliente.filhos.length > 0 && <InfoBadge icon={Users} text={`${cliente.filhos.length} filho(s)`} />}
          <InfoBadge icon={ThumbsUp} text={`${cliente.indicacoes} indicações`} />
        </div>
      </CardContent>
      
      <div className="flex items-center justify-end p-2 bg-gray-50 border-t">
        <Button variant="ghost" size="icon" onClick={onView}><Eye className="w-4 h-4 text-gray-600" /></Button>
        <Button variant="ghost" size="icon" onClick={onEdit}><Edit className="w-4 h-4 text-blue-600" /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="w-4 h-4 text-red-600" /></Button>
      </div>
    </Card>
  );
}