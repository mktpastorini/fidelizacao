import { Cliente } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Phone, User, Eye, MoreVertical, Edit, Trash2, DoorOpen } from "lucide-react";
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ClienteCardProps = {
  cliente: Cliente;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const InfoLine = ({ icon: Icon, text }: { icon: React.ElementType, text: string | number }) => (
  <div className="flex items-center text-xs text-muted-foreground">
    <Icon className="w-3 h-3 mr-2" />
    <span>{text}</span>
  </div>
);

export function ClienteCard({ cliente, onView, onEdit, onDelete }: ClienteCardProps) {
  const tempoCliente = formatDistanceToNowStrict(new Date(cliente.cliente_desde), { locale: ptBR });
  const preferenciaPrincipal = cliente.gostos?.pizza_favorita ? `Gosta de ${cliente.gostos.pizza_favorita}` : 'Sem preferências registradas.';

  return (
    <Card className="bg-card border hover:border-primary/50 transition-colors">
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={cliente.avatar_url || undefined} />
                <AvatarFallback>
                  <User className="h-6 w-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-bold text-primary">{cliente.nome}</h3>
                <p className="text-xs text-muted-foreground">Cliente há {tempoCliente}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="space-y-1 text-sm border-t pt-3">
            <p className="text-foreground italic text-xs">"{preferenciaPrincipal}"</p>
            {cliente.whatsapp && <InfoLine icon={Phone} text={cliente.whatsapp} />}
            <InfoLine icon={DoorOpen} text={`${cliente.visitas || 0} visita(s)`} />
          </div>
        </div>

        <div className="pt-4 mt-auto">
            <Button variant="outline" className="w-full" onClick={onView}>
                <Eye className="w-4 h-4 mr-2" />
                Ver Perfil
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}