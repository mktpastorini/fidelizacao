import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffProfile } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/relatorios/DateRangePicker";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, User, BarChart2, User as UserIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSuperadminId } from "@/hooks/useSuperadminId";
import { useSettings } from "@/contexts/SettingsContext";
import { StatCard } from "@/components/dashboard/StatCard";

type TipStat = {
  garcom_id: string;
  garcom_nome: string;
  total_gorjetas: number;
  total_pedidos: number;
};

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

async function fetchTipStats(userId: string, dateRange: DateRange): Promise<TipStat[]> {
  if (!dateRange.from || !dateRange.to) return [];
  
  const { data, error } = await supabase.rpc('get_tip_stats', {
    p_user_id: userId,
    start_date: startOfDay(dateRange.from).toISOString(),
    end_date: endOfDay(dateRange.to).toISOString(),
  });
  if (error) throw new Error(error.message);
  return data || [];
}

const formatCurrency = (value: number | undefined) => {
  if (typeof value !== 'number') return "R$ 0,00";
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function GorjetasPage() {
  const { userRole } = useSettings();
  const { superadminId, isLoadingSuperadminId } = useSuperadminId();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(getBrazilTime()),
    to: endOfDay(getBrazilTime()),
  });

  const userIdToFetch = useMemo(() => {
    // Superadmin, Admin, Gerente E Garçom podem ver as gorjetas.
    // Os dados são sempre associados ao Superadmin.
    if (userRole && ['superadmin', 'admin', 'gerente', 'garcom'].includes(userRole)) {
      return superadminId;
    }
    return null;
  }, [userRole, superadminId]);

  const isQueryEnabled = !!userIdToFetch && !!dateRange?.from && !!dateRange?.to && !isLoadingSuperadminId;

  const { data: tipStats, isLoading } = useQuery({
    queryKey: ["tipStats", userIdToFetch, dateRange],
    queryFn: () => fetchTipStats(userIdToFetch!, dateRange!),
    enabled: isQueryEnabled,
  });

  const totalTips = useMemo(() => {
    return tipStats?.reduce((sum, stat) => sum + stat.total_gorjetas, 0) || 0;
  }, [tipStats]);

  if (isLoading || isLoadingSuperadminId) {
    return <Skeleton className="h-96 w-full" />;
  }
  
  // Se o usuário for garçom, ele terá userIdToFetch, então a tela será renderizada.
  // Se o usuário não tiver permissão (ex: balcao, cozinha), o RoleGuard no App.tsx já o bloqueou.
  // Se o userIdToFetch for null aqui, é porque o RoleGuard falhou ou o userRole não está na lista permitida.
  if (!userIdToFetch) {
    // Este bloco só deve ser atingido se o RoleGuard no App.tsx falhar, mas mantemos a mensagem de erro genérica.
    return (
      <div className="p-8">
        <p className="text-destructive">Acesso negado. Sua função não está autorizada a ver esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gorjetas</h1>
          <p className="text-muted-foreground mt-1">Análise de gorjetas por garçom no período selecionado.</p>
        </div>
        <DateRangePicker date={dateRange} setDate={setDateRange} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Gorjeta Total no Período" 
          value={formatCurrency(totalTips)} 
          icon={DollarSign} 
          variant="green" 
        />
        <StatCard 
          title="Garçons com Gorjeta" 
          value={tipStats?.length || 0} 
          icon={User} 
          variant="blue" 
        />
        <StatCard 
          title="Ticket Médio de Gorjeta" 
          value={formatCurrency(totalTips / (tipStats?.length || 1))} 
          icon={BarChart2} 
          variant="orange" 
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gorjetas por Garçom</CardTitle>
        </CardHeader>
        <CardContent>
          {tipStats && tipStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Garçom</TableHead>
                  <TableHead className="text-right">Total de Gorjetas</TableHead>
                  <TableHead className="text-right">Total de Pedidos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipStats.map((stat) => (
                  <TableRow key={stat.garcom_id}>
                    <TableCell className="font-medium flex items-center">
                      <UserIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                      {stat.garcom_nome || `ID: ${stat.garcom_id.substring(0, 8)}...`}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      {formatCurrency(stat.total_gorjetas)}
                    </TableCell>
                    <TableCell className="text-right">{stat.total_pedidos}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma gorjeta registrada no período selecionado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}