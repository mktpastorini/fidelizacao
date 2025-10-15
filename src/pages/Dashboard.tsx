import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TopClientsCard } from "@/components/dashboard/TopClientsCard";
import { RecentArrivalsCard } from "@/components/dashboard/RecentArrivalsCard";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, ChefHat, BarChart2, ReceiptText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/relatorios/DateRangePicker";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

// Tipos para os dados
type DailyStats = {
  revenue_today: number;
  avg_ticket_today: number;
  occupied_tables: number;
  total_tables: number;
  kitchen_orders: number;
};

type RangeStats = {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  new_clients: number;
};

type DashboardData = {
  dailyStats: DailyStats;
  has_clients: boolean;
};

// Funções de busca de dados
async function fetchDashboardData(): Promise<DashboardData> {
  const { data: financialData, error: financialError } = await supabase.rpc('get_financial_stats_today');
  if (financialError) throw new Error(financialError.message);

  const { count: occupiedTables } = await supabase.from("mesas").select("*", { count: 'exact', head: true }).not("cliente_id", "is", null);
  const { count: totalTables } = await supabase.from("mesas").select("*", { count: 'exact', head: true });
  const { count: kitchenOrders } = await supabase.from("itens_pedido").select("*", { count: 'exact', head: true }).in("status", ["pendente", "preparando"]);
  const { count: clientCount } = await supabase.from("clientes").select("*", { count: 'exact', head: true });

  return {
    dailyStats: {
      revenue_today: financialData.revenue_today || 0,
      avg_ticket_today: financialData.avg_ticket_today || 0,
      occupied_tables: occupiedTables || 0,
      total_tables: totalTables || 0,
      kitchen_orders: kitchenOrders || 0,
    },
    has_clients: (clientCount || 0) > 0,
  };
}

async function fetchRangeStats(dateRange: DateRange): Promise<RangeStats> {
  if (!dateRange.from || !dateRange.to) {
    return { total_revenue: 0, total_orders: 0, avg_order_value: 0, new_clients: 0 };
  }
  const { data, error } = await supabase.rpc('get_stats_by_date_range', {
    start_date: dateRange.from.toISOString(),
    end_date: dateRange.to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : { total_revenue: 0, total_orders: 0, avg_order_value: 0, new_clients: 0 };
}

// Componente principal
export default function DashboardPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data: dailyData, isLoading: isLoadingDaily } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: fetchDashboardData,
  });

  const { data: rangeData, isLoading: isLoadingRange } = useQuery({
    queryKey: ["rangeStats", date],
    queryFn: () => fetchRangeStats(date!),
    enabled: !!date?.from && !!date?.to,
  });

  const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number') return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (isLoadingDaily) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (!dailyData?.has_clients) {
    return <WelcomeCard />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Analise a performance do seu negócio.</p>
      </div>

      <Tabs defaultValue="today">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="today">Visão de Hoje</TabsTrigger>
          <TabsTrigger value="period">Análise por Período</TabsTrigger>
        </TabsList>
        
        <TabsContent value="today" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Faturamento do Dia" value={formatCurrency(dailyData.dailyStats.revenue_today)} icon={DollarSign} />
            <StatCard title="Ticket Médio do Dia" value={formatCurrency(dailyData.dailyStats.avg_ticket_today)} icon={BarChart2} />
            <StatCard title="Mesas Ocupadas" value={`${dailyData.dailyStats.occupied_tables} de ${dailyData.dailyStats.total_tables}`} icon={Users} />
            <StatCard title="Pedidos na Cozinha" value={dailyData.dailyStats.kitchen_orders} icon={ChefHat} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><RevenueChart /></div>
            <div><TopClientsCard /></div>
          </div>
          <div><RecentArrivalsCard /></div>
        </TabsContent>

        <TabsContent value="period" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <DateRangePicker date={date} setDate={setDate} />
          </div>
          {isLoadingRange ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Faturamento Total" value={formatCurrency(rangeData?.total_revenue)} icon={DollarSign} />
              <StatCard title="Total de Pedidos" value={rangeData?.total_orders || 0} icon={ReceiptText} />
              <StatCard title="Ticket Médio" value={formatCurrency(rangeData?.avg_order_value)} icon={BarChart2} />
              <StatCard title="Novos Clientes" value={rangeData?.new_clients || 0} icon={Users} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}