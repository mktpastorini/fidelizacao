import { Cozinheiro } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, MoreVertical, Edit, Trash2, Mail, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type CozinheiroCardProps = {
  cozinheiro: Cozinheiro;
  onEdit: () => void;
  onDelete: () => void;
};

const InfoLine = ({ icon: Icon, text }: { icon: React.ElementType, text: string | number }) => (
  <div className="flex items-center text-xs text-muted-foreground">
    <Icon className="w-3 h-3 mr-2" />
    <span>{text}</span>
  </div>
);

export function CozinheiroCard({ cozinheiro, onEdit, onDelete }: CozinheiroCardProps) {
  return (
    <Card className="bg-card border hover:border-primary/50 transition-colors shadow-lg">
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 ring-2 ring-primary/50">
                <AvatarImage src={cozinheiro.avatar_url || undefined} />
                <AvatarFallback>
                  <User className="h-6 w-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-bold text-primary">{cozinheiro.nome}</h3>
                <p className="text-xs text-muted-foreground">Cozinheiro</p>
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
            {cozinheiro.email && <InfoLine icon={Mail} text={cozinheiro.email} />}
            {!cozinheiro.avatar_url && <p className="text-xs text-destructive flex items-center"><AlertTriangle className="w-3 h-3 mr-1" /> Sem foto para reconhecimento.</p>}
          </div>
        </div>

        <div className="pt-4 mt-auto">
            <Button variant="outline" className="w-full hover:bg-primary hover:text-primary-foreground" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Gerenciar
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}