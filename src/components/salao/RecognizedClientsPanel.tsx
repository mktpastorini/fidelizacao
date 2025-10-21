import { Cliente } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Phone, Heart, DoorOpen, Users } from "lucide-react"; // Importações adicionadas
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

type RecognizedClientDisplay = {
  client: Cliente;
  timestamp: number; // Para controlar a persistência
};

type RecognizedClientsPanelProps = {
  clients: RecognizedClientDisplay[];
};

const InfoLine = ({ icon: Icon, text }: { icon: React.ElementType, text: string | number }) => (
  <div className="flex items-center text-xs text-muted-foreground">
    <Icon className="w-3 h-3 mr-2" />
    <span>{text}</span>
  </div>
);

export function RecognizedClientsPanel({ clients }: RecognizedClientsPanelProps) {
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
              const tempoCliente = formatDistanceToNowStrict(new Date(client.cliente_desde), { locale: ptBR });
              const preferences = client.gostos ? Object.entries(client.gostos).filter(([_, value]) => value) : [];

              return (
                <div key={client.id} className="flex items-start gap-4 p-3 border rounded-lg bg-secondary/50">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={client.avatar_url || undefined} />
                    <AvatarFallback>
                      <User className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <h3 className="font-bold text-primary">{client.nome}</h3>
                    <p className="text-xs text-muted-foreground">Cliente há {tempoCliente}</p>
                    {client.casado_com && <InfoLine icon={Heart} text={`Cônjuge: ${client.casado_com}`} />}
                    {client.whatsapp && <InfoLine icon={Phone} text={client.whatsapp} />}
                    <InfoLine icon={DoorOpen} text={`${client.visitas || 0} visita(s)`} />
                    {preferences.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold">Preferências:</span> {preferences.map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}