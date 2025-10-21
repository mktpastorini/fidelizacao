import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cliente, Pedido, ItemPedido } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Heart, Users, ThumbsUp, Star, User, DoorOpen, ReceiptText } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ClienteDetalhesModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
};

type PedidoComItens = Pedido & { itens_pedido: ItemPedido[] };

// Função para obter data/hora no horário de Brasília
function getBrazilTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3 * 3600000)); // GMT-3 para Brasília
}

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
  <div className="p-2 bg-background/50 rounded-lg"> {/* Diminuído padding de 4 para 2 */}
    <h4 className="flex items-center font-semibold text-foreground mb-1"> {/* Diminuído margin-bottom de 2 para 1 */}
      <Icon className="w-5 h-5 mr-2 text-primary" />
      {title}
    </h4>
    <div className="pl-6 text-muted-foreground space-y-1 text-sm">{children}</div> {/* Diminuído padding-left de 7 para 6 */}
  </div>
);

const StatDisplay = ({ title, value, className, icon: Icon }: { title: string, value: string | number, className?: string, icon: React.ElementType }) => (
  <div className={`p-2 rounded-lg text-center flex flex-col items-center justify-center ${className}`}> {/* Diminuído padding de 3 para 2 */}
    <Icon className="w-5 h-5 mb-1 text-primary-foreground/80" />
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
      return { totalPedidosPagos: 0, totalSpent: 0, averageTicket: 0 };
    }
    const totalPedidosPagos = historico.length;
    const totalSpent = historico.reduce((acc, pedido) => acc + calculateTotal(pedido.itens_pedido), 0);
    const averageTicket = totalSpent / totalPedidosPagos;
    return { totalPedidosPagos, totalSpent, averageTicket };
  }, [historico]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0">
        {cliente && (
          <>
            <DialogHeader className="items-center text-center p-6 space-y-2 bg-card border-b shrink-0">
              <Avatar className="h-24 w-24 mb-2 ring-2 ring-primary ring-offset-4 ring-offset-card">
                <AvatarImage src={cliente.avatar_url || undefined} />
                <AvatarFallback>
                  <User className="h-12 w-12 text-gray-400" />
                </AvatarFallback>
              </Avatar>
              <DialogTitle className="text-2xl uppercase font-bold tracking-wider">{cliente.nome}</DialogTitle>
              <DialogDescription>
                Cliente desde {format(new Date(cliente.cliente_desde), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-6 shrink-0">
                <div className="grid grid-cols-3 gap-2">
                    <StatDisplay title="Total de Visitas" value={cliente.visitas || 0} icon={DoorOpen} className="bg-primary/80" />
                    <StatDisplay title="Pedidos Pagos" value={stats.totalPedidosPagos} icon={ReceiptText} className="bg-primary/80" />
                    <StatDisplay title="Pontos Acumulados" value={cliente.pontos || 0} icon={Star} className="bg-primary/80" /> {/* NOVO STAT */}
                </div>
            </div>

            <div className="px-6 pb-6 flex-1 min-h-0 overflow-y-auto">
              <Tabs defaultValue="historico" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3 shrink-0">
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}