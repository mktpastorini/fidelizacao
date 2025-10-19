import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Award } from "lucide-react";

type TopClientByVisits = {
  cliente_id: string;
  nome: string;
  avatar_url: string | null;
  visit_count: number;
};

async function fetchTopClientsByVisits(period: 'all_time' | 'last_30_days'): Promise<TopClientByVisits[]> {
  const days_period = period === 'last_30_days' ? 30 : 0;
  const { data, error } = await supabase.rpc('get_top_clients_by_visits', { limit_count: 3, days_period });
  if (error) throw new Error(error.message);
  return data || [];
}

export function TopClientsByVisitsCard() {
  const [period, setPeriod] = useState<'all_time' | 'last_30_days'>('all_time');

  const { data: topClients, isLoading } = useQuery({
    queryKey: ["topClientsByVisits", period],
    queryFn: () => fetchTopClientsByVisits(period),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes Mais Frequentes</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={period} onValueChange={(value) => setPeriod(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="all_time">Todo Período</TabsTrigger>
            <TabsTrigger value="last_30_days">Últimos 30 dias</TabsTrigger>
          </TabsList>
          <div className="min-h-[180px]">
            {isLoading ? (
              <div className="space-y-4 pt-2">
                {[...Array(3)].map((_, i) => (
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
              <div className="space-y-6 pt-2">
                {topClients.map((client, index) => (
                  <div key={client.cliente_id} className="flex items-center gap-4">
                    {index === 0 && <Award className="w-5 h-5 text-amber-500" />}
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{client.nome}</p>
                      <p className="text-sm text-muted-foreground">{client.visit_count} visita(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground flex items-center justify-center h-full">
                <p>Nenhum dado de visitas para exibir o ranking.</p>
              </div>
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}