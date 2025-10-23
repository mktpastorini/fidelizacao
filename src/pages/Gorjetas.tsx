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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TipDetailsModal } from "@/components/gorjetas/TipDetailsModal";
import { Button } from "@/components/ui/button";

type TipStat = {
  garcom_id: string;
  garcom_nome: string;
  total_gorjetas: number;
  total_pedidos: number;
};

type TipDetail = {
  id: string;
  cliente_nome: string;
  valor: number;
  data: string;
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

async function fetchTipDetails(garcomId: string, dateRange: DateRange): Promise<TipDetail[]> {
  if (!dateRange.from || !dateRange.to) return [];
  
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      cliente:clientes(nome),
      gorjeta_valor,
      closed_at
    `)
    .eq('garcom_id', garcomId)
    .gte('closed_at', startOfDay(dateRange.from).toISOString())
    .lte('closed_at', endOfDay(dateRange.to).toISOString())
    .order('closed_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  if (!data) return [];
  
  return data.map(p => ({
    id: p.id,
    cliente_nome: p.cliente?.nome || 'N/A',
    valor: p.gorjeta_valor || 0,
    data: p.closed_at,
  }));
}

const formatCurrency = (value: number | undefined) => {
  if (typeof value !== 'number') return "R$ 0,00";
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function GorjetasPage() {
  const { userRole } = useSettings();
  const { superadminId, isLoadingSuperadminId, errorSuperadminId } = useSuperadminId();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(getBrazilTime()),
    to: endOfDay(getBrazilTime()),
  });

  const userIdToFetch = useMemo(() => {
    // Garçom, Gerente, Admin e Superadmin usam o ID do Superadmin para buscar dados.
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

  const [selectedGarcomId, setSelectedGarcomId] = useState<string | null>(null);
  const [isTipDetailsOpen, setIsTipDetailsOpen] = useState(false);
  const [tipDetails, setTipDetails] = useState<TipDetail[]>([]);
  const [selectedGarcomNome, setSelectedGarcomNome] = useState<string>("");

  const totalTips = useMemo(() => {
    return tipStats?.reduce((sum, stat) => sum + stat.total_gorjetas, 0) || 0;
  }, [tipStats]);

  const openTipDetails = async (garcomId: string, garcomNome: string) => {
    setSelectedGarcomId(garcomId);
    setSelectedGarcomNome(garcomNome);
    try {
      const details = await fetchTipDetails(garcomId, dateRange!);
      setTipDetails(details);
      setIsTipDetailsOpen(true);
    } catch (error: any) {
      setTipDetails([]);
      setIsTipDetailsOpen(false);
      alert(`Erro ao carregar detalhes das gorjetas: ${error.message}`);
    }
  };

  if (isLoadingSuperadminId || isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  
  if (errorSuperadminId) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertTitle>Erro de Configuração</AlertTitle>
        <AlertDescription>
          Não foi possível carregar o ID do Superadmin, o que é necessário para buscar os dados de gorjeta. Verifique se o Edge Function 'get-superadmin-id' está funcionando corretamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!userIdToFetch) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertTitle>Erro de Acesso</AlertTitle>
        <AlertDescription>
          Sua função ({userRole}) está autorizada, mas o ID do Superadmin não foi encontrado. Verifique a configuração do perfil Superadmin.
        </AlertDescription>
      </Alert>
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
                      <button 
                        className="text-blue-600 hover:underline"
                        onClick={() => openTipDetails(stat.garcom_id, stat.garcom_nome)}
                      >
                        {stat.garcom_nome || `ID: ${stat.garcom_id.substring(0, 8)}...`}
                      </button>
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

      <TipDetailsModal 
        isOpen={isTipDetailsOpen} 
        onOpenChange={setIsTipDetailsOpen} 
        garcomNome={selectedGarcomNome} 
        tipDetails={tipDetails} 
      />
    </div>
  );
}