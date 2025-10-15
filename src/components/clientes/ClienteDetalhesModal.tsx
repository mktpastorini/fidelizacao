import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Pedido, ItemPedido } from "@/types/supabase";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Heart, Users, ThumbsUp, Star, User } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ClienteDetalhesModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
};

type PedidoComItens = Pedido & { itens_pedido: ItemPedido[] };

async function fetchHistoricoCliente(clienteId: string): Promise<PedidoComItens[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("*, itens_pedido(*)")
    .eq("cliente_id", clienteId)
    .eq("status", "pago")
    .order("closed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as PedidoComItens[]) || [];
}

const DetailSection = ({ title, icon: Icon, children }: { title: string, icon: React.ElementType, children: React.ReactNode }) => (
  <div className="p-4 bg-background/50 rounded-lg">
    <h4 className="flex items-center font-semibold text-foreground mb-2">
      <Icon className="w-5 h-5 mr-2 text-primary" />
      {title}
    </h4>
    <div className="pl-7 text-muted-foreground space-y-1 text-sm">{children}</div>
  </div>
);

const StatDisplay = ({ title, value, className }: { title: string, value: string | number, className?: string }) => (
  <div className={`p-3 rounded-lg text-center ${className}`}>
    <p className="text-xs text-primary-foreground/80">{title}</p>
    <p className="text-xl font-bold text-primary-foreground">{value}</p>
  </div>
);

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ClienteDetalhesModal({ isOpen, onOpenChange, cliente }: ClienteDetalhesModalProps) {
  const { data: historico, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['historicoCliente', cliente?.id],
    queryFn: () => fetchHistoricoCliente(cliente!.id),
    enabled: isOpen && !!cliente,
  });

  const calculateTotal = (itens: ItemPedido[]) => {
    return itens.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0);
  };

  const stats = useMemo(() => {
    if (!historico || historico.length === 0) {
      return { totalVisits: 0, totalSpent: 0, averageTicket: 0 };
    }
    const totalVisits = historico.length;
    const totalSpent = historico.reduce((acc, pedido) => acc + calculateTotal(pedido.itens_pedido), 0);
    const averageTicket = totalSpent / totalVisits;
    return { totalVisits, totalSpent, averageTicket };
  }, [historico]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md p-0 flex flex-col">
        {cliente && (
          <>
            <SheetHeader className="items-center text-center p-6 space-y-2 bg-card border-b">
              <Avatar className="h-24 w-24 mb-2 ring-2 ring-primary ring-offset-4 ring-offset-card">
                <AvatarImage src={cliente.avatar_url || undefined} />
                <AvatarFallback>
                  <User className="h-12 w-12 text-gray-400" />
                </AvatarFallback>
              </Avatar>
              <SheetTitle className="text-2xl uppercase font-bold tracking-wider">{cliente.nome}</SheetTitle>
              <SheetDescription>
                Cliente desde {format(new Date(cliente.cliente_desde), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </SheetDescription>
            </SheetHeader>
            
            <div className="p-6">
                <div className="grid grid-cols-3 gap-2">
                    <StatDisplay title="Total de Visitas" value={stats.totalVisits} className="bg-primary/80" />
                    <StatDisplay title="Gasto Total" value={formatCurrency(stats.totalSpent)} className="bg-primary/80" />
                    <StatDisplay title="Ticket Médio" value={formatCurrency(stats.averageTicket)} className="bg-primary/80" />
                </div>
            </div>

            <Tabs defaultValue="historico" className="w-full px-6 flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
                <TabsTrigger value="preferencias">Preferências</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-y-auto mt-4">
                <TabsContent value="perfil" className="space-y-4">
                  <DetailSection title="Contato" icon={Phone}>
                    <p>WhatsApp: {cliente.whatsapp || "Não informado"}</p>
                  </DetailSection>
                  <DetailSection title="Família" icon={Heart}>
                    <p>Cônjuge: {cliente.casado_com || "Não informado"}</p>
                    {cliente.filhos && cliente.filhos.length > 0 && (
                      <div>
                        <p className="font-medium">Filhos:</p>
                        <ul className="list-disc list-inside">
                          {cliente.filhos.map(filho => (
                            <li key={filho.id}>{filho.nome} ({filho.idade || '?'} anos)</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </DetailSection>
                  <DetailSection title="Fidelidade" icon={ThumbsUp}>
                    <p>Indicou {cliente.indicacoes} cliente(s).</p>
                    {cliente.indicado_por && <p>Indicado por: <span className="font-semibold">{cliente.indicado_por.nome}</span></p>}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="historico">
                  {isHistoryLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : historico && historico.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historico.map(pedido => (
                          <TableRow key={pedido.id}>
                            <TableCell className="text-xs">{pedido.closed_at ? format(new Date(pedido.closed_at), "dd/MM/yy HH:mm", { locale: ptBR }) : 'N/A'}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(calculateTotal(pedido.itens_pedido))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhum histórico de compras.</p>
                  )}
                </TabsContent>

                <TabsContent value="preferencias" className="space-y-4">
                  <DetailSection title="Gostos e Observações" icon={Star}>
                    {cliente.gostos && typeof cliente.gostos === 'object' && Object.keys(cliente.gostos).length > 0 ? (
                      Object.entries(cliente.gostos).map(([key, value]) => (
                        value && <p key={key}><span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {String(value)}</p>
                      ))
                    ) : <p>Nenhuma preferência cadastrada.</p>}
                  </DetailSection>
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}