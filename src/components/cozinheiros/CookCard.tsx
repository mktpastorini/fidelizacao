import { Cozinheiro } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Edit, Trash2, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type CookCardProps = {
  cozinheiro: Cozinheiro;
  onEdit: () => void;
  onDelete: () => void;
};

export function CookCard({ cozinheiro, onEdit, onDelete }: CookCardProps) {
  return (
    <Card className="bg-card border hover:border-primary/50 transition-colors shadow-lg">
      <CardContent className="p-4 flex flex-col justify-between h-full">
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
              {cozinheiro.email && (
                <div className="flex items-center text-xs text-muted-foreground">
                    <Mail className="w-3 h-3 mr-1" />
                    <span>{cozinheiro.email}</span>
                </div>
              )}
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
        
        <div className="pt-4 mt-auto">
            <p className="text-xs text-muted-foreground">ID de Reconhecimento: {cozinheiro.id.substring(0, 8)}...</p>
        </div>
      </CardContent>
    </Card>
  );
}