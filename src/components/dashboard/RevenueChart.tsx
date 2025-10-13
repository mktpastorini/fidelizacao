import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "../ui/skeleton";

type DailyRevenue = {
  day: string;
  total_revenue: number;
};

async function fetchDailyRevenue(): Promise<DailyRevenue[]> {
  const { data, error } = await supabase.rpc('get_daily_revenue', { days_to_check: 7 });
  if (error) throw new Error(error.message);
  return data;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateStr: string) => format(new Date(dateStr), "dd/MM", { locale: ptBR });

export function RevenueChart() {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["dailyRevenue"],
    queryFn: fetchDailyRevenue,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Faturamento dos Últimos 7 Dias</CardTitle>
          <CardDescription>Analisando os dados...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturamento dos Últimos 7 Dias</CardTitle>
        <CardDescription>Visão geral do faturamento diário da última semana.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickFormatter={formatDate}
              stroke="#888888"
              fontSize={12}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickFormatter={(value) => `R$${value}`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
              labelFormatter={formatDate}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '0.5rem' }}
            />
            <Bar dataKey="total_revenue" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}