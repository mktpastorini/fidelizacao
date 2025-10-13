import { useQuery } from "@tanstack/react-query";
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
  <div>
    <h4 className="flex items-center font-semibold text-gray-700 mb-2">
      <Icon className="w-5 h-5 mr-2 text-blue-500" />
      {title}
    </h4>
    <div className="pl-7 text-gray-600 space-y-1">{children}</div>
  </div>
);

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ClienteDetalhesModal({ isOpen, onOpenChange, cliente }: ClienteDetalhesModalProps) {
  if (!cliente) return null;

  const { data: historico, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['historicoCliente', cliente.id],
    queryFn: () => fetchHistoricoCliente(cliente.id),
    enabled: isOpen,
  });

  const calculateTotal = (itens: ItemPedido[]) => {
    return itens.reduce((acc, item) => acc + (item.preco || 0) * item.quantidade, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="items-center text-center pb-4 border-b">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarImage src={cliente.avatar_url || undefined} />
            <AvatarFallback>
              <User className="h-12 w-12 text-gray-400" />
            </AvatarFallback>
          </Avatar>
          <DialogTitle className="text-2xl">{cliente.nome}</DialogTitle>
          <DialogDescription>
            Cliente desde {format(new Date(cliente.cliente_desde), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="perfil" className="w-full pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="preferencias">Preferências</TabsTrigger>
          </TabsList>
          
          <TabsContent value="perfil" className="py-4 space-y-6">
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
            </DetailSection>
          </TabsContent>

          <TabsContent value="historico" className="py-4">
            {isHistoryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : historico && historico.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map(pedido => (
                    <TableRow key={pedido.id}>
                      <TableCell>{pedido.closed_at ? format(new Date(pedido.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'N/A'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(calculateTotal(pedido.itens_pedido))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500 py-8">Nenhum histórico de compras encontrado.</p>
            )}
          </TabsContent>

          <TabsContent value="preferencias" className="py-4 space-y-4">
            <DetailSection title="Gostos e Observações" icon={Star}>
              {cliente.gostos && typeof cliente.gostos === 'object' && Object.keys(cliente.gostos).length > 0 ? (
                Object.entries(cliente.gostos).map(([key, value]) => (
                  <p key={key}><span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {String(value)}</p>
                ))
              ) : <p>Nenhuma preferência cadastrada.</p>}
            </DetailSection>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}