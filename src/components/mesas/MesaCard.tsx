import { Mesa } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, User } from "lucide-react";

type MesaCardProps = {
  mesa: Mesa;
  onClick: () => void;
  children?: React.ReactNode;
};

export function MesaCard({ mesa, onClick, children }: MesaCardProps) {
  const isOcupada = !!mesa.cliente;

  return (
    <Card
      className={cn(
        "transition-all",
        isOcupada ? "bg-blue-50 border-blue-200" : "bg-white"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="cursor-pointer" onClick={onClick}>Mesa {mesa.numero}</span>
          {children}
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-xs">
          <Users className="w-3 h-3" />
          <span>Capacidade: {mesa.capacidade}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="cursor-pointer" onClick={onClick}>
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