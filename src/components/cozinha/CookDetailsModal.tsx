import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Utensils, Clock, Table as TableIcon, Loader2, Package } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { ScrollArea } from "../ui/scroll-area";

type CookDetail = {
  item_id: string;
  nome_produto: string;
  local_pedido: string;
  hora_inicio_preparo: string;
  hora_entrega: string;
  tempo_conclusao_min: number;
};

type CookDetailsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cookId: string | null;
  cookName: string | null;
  userId: string | null;
  dateRange: DateRange | undefined;
};

async function fetchCookDetails(userId: string, cookId: string, dateRange: DateRange): Promise<CookDetail[]> {
  if (!userId || !cookId || !dateRange.from || !dateRange.to) return [];

  const { data, error } = await supabase.rpc('get_cook_performance_details', {
    p_user_id: userId,
    p_cozinheiro_id: cookId,
    start_date: dateRange.from.toISOString(),
    end_date: dateRange.to.toISOString(),
  });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export function CookDetailsModal({
  isOpen,
  onOpenChange,
  cookId,
  cookName,
  userId,
  dateRange,
}: CookDetailsModalProps) {
  const { data: details, isLoading } = useQuery({
    queryKey: ["cookDetails", cookId, dateRange],
    queryFn: () => fetchCookDetails(userId!, cookId!, dateRange!),
    enabled: isOpen && !!cookId && !!userId && !!dateRange?.from && !!dateRange?.to,
  });

  if (!cookId || !userId || !dateRange) return null;

  const totalPratos = details?.length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="w-6 h-6" /> Detalhes de Desempenho
          </DialogTitle>
          <DialogDescription>
            Itens concluídos por <span className="font-semibold text-primary">{cookName}</span> no período de {format(dateRange.from!, 'dd/MM/yyyy', { locale: ptBR })} a {format(dateRange.to!, 'dd/MM/yyyy', { locale: ptBR })}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="shrink-0 mb-4">
            <p className="text-sm font-medium">Total de Pratos Concluídos: <span className="font-bold text-primary">{totalPratos}</span></p>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Carregando detalhes...</p>
            </div>
          ) : totalPratos > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-[150px] text-center">Local do Pedido</TableHead>
                  <TableHead className="w-[150px]">Início Preparo</TableHead>
                  <TableHead className="w-[150px]">Conclusão</TableHead>
                  <TableHead className="w-[100px] text-right">Tempo (min)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details?.map((detail) => (
                  <TableRow key={detail.item_id}>
                    <TableCell className="font-medium">{detail.nome_produto}</TableCell>
                    <TableCell className="text-center text-xs">
                        {detail.local_pedido.startsWith('Mesa') ? <TableIcon className="w-4 h-4 mr-1 inline-block" /> : <Package className="w-4 h-4 mr-1 inline-block" />}
                        {detail.local_pedido}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(detail.hora_inicio_preparo), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(detail.hora_entrega), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {detail.tempo_conclusao_min.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum prato concluído por este cozinheiro no período.</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}