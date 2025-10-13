import { Mesa } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, User } from "lucide-react";

type MesaCardProps = {
  mesa: Mesa;
  onClick: () => void;
};

export function MesaCard({ mesa, onClick }: MesaCardProps) {
  const isOcupada = !!mesa.cliente;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg",
        isOcupada ? "bg-blue-50 border-blue-200" : "bg-white"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Mesa {mesa.numero}</span>
          <div className={cn("w-3 h-3 rounded-full", isOcupada ? "bg-green-500" : "bg-gray-400")}></div>
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-xs">
          <Users className="w-3 h-3" />
          <span>Capacidade: {mesa.capacidade}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOcupada ? (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-blue-800">{mesa.cliente?.nome}</span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Livre</p>
        )}
      </CardContent>
    </Card>
  );
}