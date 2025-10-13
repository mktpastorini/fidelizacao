import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Clock } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type RecentArrival = {
  cliente_id: string;
  nome: string;
  avatar_url: string | null;
  arrival_time: string;
};

async function fetchRecentArrivals(): Promise<RecentArrival[]> {
  const { data, error } = await supabase.rpc('get_recent_arrivals', { limit_count: 5 });
  if (error) throw new Error(error.message);
  return data || [];
}

export function RecentArrivalsCard() {
  const { data: recentArrivals, isLoading } = useQuery({
    queryKey: ["recentArrivals"],
    queryFn: fetchRecentArrivals,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chegadas Recentes</CardTitle>
        <CardDescription>Últimos clientes que chegaram ao estabelecimento.</CardDescription>
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
        ) : recentArrivals && recentArrivals.length > 0 ? (
          <div className="space-y-4">
            {recentArrivals.map((arrival) => (
              <div key={arrival.cliente_id} className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={arrival.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{arrival.nome}</p>
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Clock className="w-3 h-3 mr-1.5" />
                    {formatDistanceToNow(new Date(arrival.arrival_time), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aguardando a chegada do primeiro cliente do dia.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}