import { Cliente } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Phone, Heart, DoorOpen, Users, Table } from "lucide-react"; // Adicionado Table icon
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Importado Badge

type RecognizedClientDisplay = {
  client: Cliente;
  timestamp: number; // Para controlar a persistência
};

type RecognizedClientsPanelProps = {
  clients: RecognizedClientDisplay[];
  onAllocateClient: (client: Cliente) => void; // Nova prop
  allocatedClientIds: string[]; // Nova prop
};

const InfoLine = ({ icon: Icon, text }: { icon: React.ElementType, text: string | number }) => (
  <div className="flex items-center text-xs text-muted-foreground">
    <Icon className="w-3 h-3 mr-2" />
    <span>{text}</span>
  </div>
);

export function RecognizedClientsPanel({ clients, onAllocateClient, allocatedClientIds }: RecognizedClientsPanelProps) {
  if (clients.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground p-6">
          <Users className="w-12 h-12 mx-auto mb-4" />
          <p>Nenhum cliente reconhecido recentemente.</p>
          <p className="text-sm">Aguardando detecção de rostos.</p>
        </CardContent>
      </Card>
    );
  }

  const allocatedSet = new Set(allocatedClientIds);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" /> Clientes Reconhecidos ({clients.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-4 p-6 pt-0">
            {clients.map(({ client }) => {
              const isValidDate = client.cliente_desde && !isNaN(new Date(client.cliente_desde).getTime());
              const tempoCliente = isValidDate
                ? formatDistanceToNowStrict(new Date(client.cliente_desde), { locale: ptBR })
                : "Data não informada";

              const preferences = client.gostos ? Object.entries(client.gostos).filter(([_, value]) => value) : [];
              const isAllocated = allocatedSet.has(client.id);

              return (
                <div 
                  key={client.id} 
                  className="flex flex-col items-start gap-3 p-3 border rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => !isAllocated && onAllocateClient(client)} // Clicável apenas se não estiver alocado
                >
                  <div className="flex items-center gap-4 w-full">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="h-6 w-6 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-bold text-primary">{client.nome}</h3>
                      <p className="text-xs text-muted-foreground">Cliente há {tempoCliente}</p>
                    </div>
                    {isAllocated && (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-primary-foreground flex items-center gap-1">
                        <Table className="w-3 h-3" /> Alocado
                      </Badge>
                    )}
                  </div>
                  
                  <div className="w-full space-y-1 text-sm border-t pt-3">
                    {client.casado_com && <InfoLine icon={Heart} text={`Cônjuge: ${client.casado_com}`} />}
                    {client.whatsapp && <InfoLine icon={Phone} text={client.whatsapp} />}
                    <InfoLine icon={DoorOpen} text={`${client.visitas || 0} visita(s)`} />
                    {preferences.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold">Preferências:</span> {preferences.map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join(', ')}
                      </div>
                    )}
                  </div>
                  {!isAllocated && (
                    <Button size="sm" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); onAllocateClient(client); }}>
                      Alocar à Mesa
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}