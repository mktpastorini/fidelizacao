import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { TopClientsCard } from "@/components/dashboard/TopClientsCard";
import { RecentArrivalsCard } from "@/components/dashboard/RecentArrivalsCard";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Users, ChefHat, BarChart2 } from "lucide-react";

type DashboardData = {
  stats: {
    revenue_today: number;
    avg_ticket_today: number;
    occupied_tables: number;
    total_tables: number;
    kitchen_orders: number;
  };
  has_clients: boolean;
};

async function fetchDashboardData(): Promise<DashboardData> {
  const { data: financialData, error: financialError } = await supabase.rpc('get_financial_stats_today');
  if (financialError) throw new Error(financialError.message);

  const { count: occupiedTables, error: occupiedError } = await supabase
    .from("mesas")
    .select("*", { count: 'exact', head: true })
    .not("cliente_id", "is", null);
  if (occupiedError) throw new Error(occupiedError.message);

  const { count: totalTables, error: totalError } = await supabase
    .from("mesas")
    .select("*", { count: 'exact', head: true });
  if (totalError) throw new Error(totalError.message);

  const { count: kitchenOrders, error: kitchenError } = await supabase
    .from("itens_pedido")
    .select("*", { count: 'exact', head: true })
    .in("status", ["pendente", "preparando"]);
  if (kitchenError) throw new Error(kitchenError.message);

  const { count: clientCount, error: clientError } = await supabase
    .from("clientes")
    .select("*", { count: 'exact', head: true });
  if (clientError) throw new Error(clientError.message);

  return {
    stats: {
      revenue_today: financialData.revenue_today || 0,
      avg_ticket_today: financialData.avg_ticket_today || 0,
      occupied_tables: occupiedTables || 0,
      total_tables: totalTables || 0,
      kitchen_orders: kitchenOrders || 0,
    },
    has_clients: (clientCount || 0) > 0,
  };
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: fetchDashboardData,
  });

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data?.has_clients) {
    return <WelcomeCard />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do seu negócio hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Faturamento do Dia" value={formatCurrency(data.stats.revenue_today)} icon={DollarSign} />
        <StatCard title="Ticket Médio do Dia" value={formatCurrency(data.stats.avg_ticket_today)} icon={BarChart2} />
        <StatCard title="Mesas Ocupadas" value={`${data.stats.occupied_tables} de ${data.stats.total_tables}`} icon={Users} />
        <StatCard title="Pedidos na Cozinha" value={data.stats.kitchen_orders} icon={ChefHat} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <TopClientsCard />
        </div>
      </div>
      
      <div>
        <RecentArrivalsCard />
      </div>
    </div>
  );
}