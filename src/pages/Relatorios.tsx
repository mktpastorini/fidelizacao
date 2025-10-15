import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { DateRangePicker } from "@/components/relatorios/DateRangePicker";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ReceiptText, Users, BarChart2 } from "lucide-react";

type Stats = {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  new_clients: number;
};

async function fetchStats(dateRange: DateRange): Promise<Stats> {
  // Garante que temos um intervalo de datas válido antes de chamar a função
  if (!dateRange.from || !dateRange.to) {
    return { total_revenue: 0, total_orders: 0, avg_order_value: 0, new_clients: 0 };
  }

  const { data, error } = await supabase
    .rpc('get_stats_by_date_range', {
      start_date: dateRange.from.toISOString(),
      end_date: dateRange.to.toISOString(),
    });

  if (error) {
    console.error("Erro ao buscar estatísticas:", error);
    throw new Error(error.message);
  }

  // A função agora sempre retorna um array, pegamos o primeiro (e único) resultado.
  return data && data.length > 0 ? data[0] : { total_revenue: 0, total_orders: 0, avg_order_value: 0, new_clients: 0 };
}

export default function RelatoriosPage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["stats", date],
    queryFn: () => fetchStats(date!),
    enabled: !!date?.from && !!date?.to,
  });

  const formatCurrency = (value: number | undefined) => {
    if (typeof value !== 'number') return "R$ 0,00";
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-gray-600 mt-2">
            Analise o desempenho do seu negócio no período selecionado.
          </p>
        </div>
        <DateRangePicker date={date} setDate={setDate} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : isError ? (
        <p className="text-red-500">Erro ao carregar as estatísticas. Por favor, tente novamente.</p>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Faturamento Total" value={formatCurrency(stats.total_revenue)} icon={DollarSign} />
          <StatCard title="Total de Pedidos" value={stats.total_orders} icon={ReceiptText} />
          <StatCard title="Ticket Médio" value={formatCurrency(stats.avg_order_value)} icon={BarChart2} />
          <StatCard title="Novos Clientes" value={stats.new_clients} icon={Users} />
        </div>
      ) : (
        <p>Selecione um período para ver os dados.</p>
      )}
    </div>
  );
}