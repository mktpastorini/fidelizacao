import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
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
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle>Faturamento dos Últimos 7 Dias</CardTitle>
        <CardDescription>Visão geral do faturamento diário da última semana.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="day"
              tickFormatter={formatDate}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => `R$${value}`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
              labelFormatter={formatDate}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))', 
                borderRadius: '0.5rem',
                color: 'hsl(var(--card-foreground))'
              }}
            />
            <Area type="monotone" dataKey="total_revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}