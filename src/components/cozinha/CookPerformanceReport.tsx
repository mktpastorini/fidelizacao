import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/relatorios/DateRangePicker";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfDay, startOfDay } from "date-fns";
import { Utensils, Clock, BarChart2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSuperadminId } from "@/hooks/useSuperadminId";
import { useSettings } from "@/contexts/SettingsContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type CookStat = {
  cozinheiro_id: string;
  cozinheiro_nome: string;
  total_pratos_finalizados: number;
  tempo_medio_preparo_min: number;
};

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

async function fetchCookStats(userId: string, dateRange: DateRange): Promise<CookStat[]> {
  if (!dateRange.from || !dateRange.to) return [];
  
  const { data, error } = await supabase.rpc('get_cook_performance_stats', {
    p_user_id: userId,
    start_date: startOfDay(dateRange.from).toISOString(),
    end_date: endOfDay(dateRange.to).toISOString(),
  });
  if (error) throw new Error(error.message);
  return data || [];
}

export function CookPerformanceReport() {
  const { userRole } = useSettings();
  const { superadminId, isLoadingSuperadminId, errorSuperadminId } = useSuperadminId();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(getBrazilTime()),
    to: endOfDay(getBrazilTime()),
  });

  const userIdToFetch = useMemo(() => {
    // Cozinha, Gerente, Admin e Superadmin usam o ID do Superadmin para buscar dados.
    if (userRole && ['superadmin', 'admin', 'gerente', 'cozinha'].includes(userRole)) {
      return superadminId;
    }
    return null;
  }, [userRole, superadminId]);

  const isQueryEnabled = !!userIdToFetch && !!dateRange?.from && !!dateRange?.to && !isLoadingSuperadminId;

  const { data: cookStats, isLoading } = useQuery({
    queryKey: ["cookPerformanceStats", userIdToFetch, dateRange],
    queryFn: () => fetchCookStats(userIdToFetch!, dateRange!),
    enabled: isQueryEnabled,
  });

  const totalDishes = useMemo(() => {
    return cookStats?.reduce((sum, stat) => sum + stat.total_pratos_finalizados, 0) || 0;
  }, [cookStats]);
  
  const averagePrepTime = useMemo(() => {
    if (!cookStats || cookStats.length === 0) return 0;
    const totalTime = cookStats.reduce((sum, stat) => sum + (stat.tempo_medio_preparo_min * stat.total_pratos_finalizados), 0);
    return totalTime / totalDishes;
  }, [cookStats, totalDishes]);

  if (isLoadingSuperadminId || isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  
  if (errorSuperadminId || !userIdToFetch) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertTitle>Erro de Configuração</AlertTitle>
        <AlertDescription>
          Não foi possível carregar os dados de desempenho. Verifique se o perfil Superadmin está configurado corretamente.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <DateRangePicker date={dateRange} setDate={setDateRange} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total de Pratos Finalizados" 
          value={totalDishes} 
          icon={Utensils} 
          variant="blue" 
        />
        <StatCard 
          title="Tempo Médio de Preparo" 
          value={`${averagePrepTime.toFixed(1)} min`} 
          icon={Clock} 
          variant="orange" 
        />
        <StatCard 
          title="Cozinheiros Ativos" 
          value={cookStats?.length || 0} 
          icon={User} 
          variant="purple" 
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho Individual</CardTitle>
        </CardHeader>
        <CardContent>
          {cookStats && cookStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cozinheiro</TableHead>
                  <TableHead className="text-right">Pratos Finalizados</TableHead>
                  <TableHead className="text-right">Tempo Médio (min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cookStats.map((stat) => (
                  <TableRow key={stat.cozinheiro_id}>
                    <TableCell className="font-medium flex items-center">
                      <UserIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                      {stat.cozinheiro_nome || `ID: ${stat.cozinheiro_id.substring(0, 8)}...`}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {stat.total_pratos_finalizados}
                    </TableCell>
                    <TableCell className="text-right text-primary">
                      {stat.tempo_medio_preparo_min.toFixed(1)} min
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum dado de preparo encontrado no período selecionado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}