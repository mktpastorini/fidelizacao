import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, User } from "lucide-react";

type TopClient = {
  cliente_id: string;
  nome: string;
  avatar_url: string | null;
  total_gasto: number;
};

async function fetchTopClients(): Promise<TopClient[]> {
  const { data, error } = await supabase.rpc('get_top_clients', { limit_count: 5 });
  if (error) throw new Error(error.message);
  return data || [];
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TopClientsCard() {
  const { data: topClients, isLoading } = useQuery({
    queryKey: ["topClients"],
    queryFn: fetchTopClients,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Clientes</CardTitle>
        <CardDescription>Clientes que mais gastaram no seu estabelecimento.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : topClients && topClients.length > 0 ? (
          <div className="space-y-4">
            {topClients.map((client, index) => (
              <div key={client.cliente_id} className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={client.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{client.nome}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(client.total_gasto)}</p>
                </div>
                {index === 0 && <Crown className="w-5 h-5 text-yellow-500" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum dado de cliente para exibir o ranking ainda.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}