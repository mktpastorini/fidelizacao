import { Mesa } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Users, User } from "lucide-react";

type Ocupante = {
  cliente: {
    id: string;
    nome: string;
  } | null;
};

type MesaCardProps = {
  mesa: Mesa & { ocupantes: Ocupante[] };
  onClick: () => void;
  children?: React.ReactNode;
};

export function MesaCard({ mesa, onClick, children }: MesaCardProps) {
  const isOcupada = !!mesa.cliente;
  const acompanhantes = mesa.ocupantes
    .map(o => o.cliente?.nome)
    .filter(Boolean) as string[];
  
  const acompanhantesCount = acompanhantes.length > 0 ? acompanhantes.length -1 : 0;

  return (
    <Card
      className={cn(
        "shadow-lg transition-all hover:shadow-xl cursor-pointer",
        isOcupada ? "border-t-4 border-blue-500" : "border-t-4 border-gray-200"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-2xl font-bold">Mesa {mesa.numero}</CardTitle>
          <CardDescription className="flex items-center gap-1 text-xs text-gray-500 pt-1">
            <Users className="w-3 h-3" />
            <span>Capacidade: {mesa.capacidade}</span>
          </CardDescription>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </CardHeader>
      <CardContent>
        {isOcupada ? (
          <div className="flex items-center gap-2 pt-2">
            <User className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-blue-800">{mesa.cliente?.nome}</span>
            {acompanhantesCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-gray-500 cursor-pointer">(+{acompanhantesCount})</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">Acompanhantes:</p>
                    <ul className="list-disc list-inside">
                      {acompanhantes.filter(nome => nome !== mesa.cliente?.nome).map((nome, index) => (
                        <li key={index}>{nome}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <p className="text-sm text-green-600 font-semibold pt-2">Livre</p>
        )}
      </CardContent>
    </Card>
  );
}