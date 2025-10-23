import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Phone, AlertTriangle, Cake, Utensils, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LowStockProduct, ItemPedido } from "@/types/supabase";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/contexts/SettingsContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area"; // Importando ScrollArea

type BirthdayClient = {
  nome: string;
  whatsapp: string | null;
};

type PendingOrderItem = ItemPedido & {
  mesa: { numero: number } | null;
  cliente: { nome: string } | null;
};

async function fetchTodaysBirthdays(): Promise<BirthdayClient[]> {
  const { data, error } = await supabase.rpc('get_todays_birthdays');
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchLowStockProducts(): Promise<LowStockProduct[]> {
  const { data, error } = await supabase.rpc('get_low_stock_products');
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchPendingOrderItems(): Promise<PendingOrderItem[]> {
  const { data, error } = await supabase
    .from("itens_pedido")
    .select(`
      id, nome_produto, quantidade, created_at, status,
      pedido:pedidos!inner(mesa:mesas(numero)),
      cliente:clientes!consumido_por_cliente_id(nome)
    `)
    .in("status", ["pendente", "preparando"]) // Mantém apenas pendente e preparando
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  
  // Mapeia e filtra para garantir que apenas itens com mesa associada sejam retornados
  return data.filter(item => item.pedido?.mesa)
    .map(item => ({
      ...item,
      mesa: item.pedido?.mesa,
      cliente: item.cliente,
    })) as PendingOrderItem[] || [];
}

export function NotificationCenter() {
  const { userRole } = useSettings();

  const isManagerOrAdmin = !!userRole && ['superadmin', 'admin', 'gerente'].includes(userRole);
  const isSaloonStaff = !!userRole && ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'].includes(userRole);

  const { data: birthdayClients } = useQuery({
    queryKey: ["todays_birthdays"],
    queryFn: fetchTodaysBirthdays,
    refetchInterval: 60000,
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["low_stock_products"],
    queryFn: fetchLowStockProducts,
    enabled: isManagerOrAdmin, // Só busca se for Manager/Admin
    refetchInterval: 60000,
  });

  const { data: pendingOrderItems } = useQuery({
    queryKey: ["pendingOrderItems"],
    queryFn: fetchPendingOrderItems,
    enabled: isSaloonStaff,
    refetchInterval: 10000,
  });

  const birthdayCount = birthdayClients?.length || 0;
  const lowStockCount = lowStockProducts?.length || 0;
  const orderItemCount = pendingOrderItems?.length || 0;

  // Garçons/Balcões só veem Pedidos e Aniversários
  // Gerentes/Admins veem Estoque, Pedidos e Aniversários
  const totalCount = isManagerOrAdmin 
    ? birthdayCount + lowStockCount + orderItemCount
    : isSaloonStaff
      ? birthdayCount + orderItemCount
      : birthdayCount;

  const shouldShowLowStock = isManagerOrAdmin && lowStockCount > 0;
  const shouldShowOrderItems = isSaloonStaff && orderItemCount > 0;
  const shouldShowBirthdays = birthdayCount > 0;
  
  // Array para controlar a ordem e os separadores
  const visibleSections: ('orders' | 'stock' | 'birthdays')[] = [];
  if (shouldShowOrderItems) visibleSections.push('orders');
  if (shouldShowLowStock) visibleSections.push('stock');
  if (shouldShowBirthdays) visibleSections.push('birthdays');


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {totalCount > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">{totalCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Central de Notificações</h4>
            <p className="text-sm text-muted-foreground">
              Você tem {totalCount} alerta(s) pendente(s).
            </p>
          </div>
          
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="grid gap-4">
              {visibleSections.map((section, index) => (
                <div key={section}>
                  {section === 'orders' && (
                    <div className="space-y-2">
                      <h5 className="flex items-center font-semibold text-primary"><Utensils className="w-4 h-4 mr-2" /> Pedidos em Aberto ({orderItemCount})</h5>
                      <div className="grid gap-2">
                        {pendingOrderItems?.map((item) => (
                          <div key={item.id} className="grid gap-1 text-sm p-2 rounded-md bg-secondary">
                            <p className="font-medium leading-none flex justify-between items-center">
                              <span>{item.nome_produto} (x{item.quantidade})</span>
                              <Badge variant="outline" className={cn(item.status === 'pendente' ? 'bg-warning/20 text-warning-foreground' : 'bg-primary/20 text-primary')}>
                                {item.status === 'pendente' ? 'Novo' : 'Preparo'}
                              </Badge>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Mesa {item.pedido?.mesa?.numero || '?'}{item.cliente?.nome && ` | Consumidor: ${item.cliente.nome}`}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatDistanceToNow(new Date(item.created_at), { locale: ptBR, addSuffix: true })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section === 'stock' && (
                    <div className="space-y-2">
                      <h5 className="flex items-center font-semibold text-warning"><AlertTriangle className="w-4 h-4 mr-2" /> Estoque Baixo ({lowStockCount})</h5>
                      <div className="grid gap-2">
                        {lowStockProducts?.map((product) => (
                          <div key={product.id} className="grid gap-1 text-sm p-2 rounded-md bg-secondary">
                            <p className="font-medium leading-none">{product.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Estoque: {product.estoque_atual} (Alerta em: {product.alerta_estoque_baixo})
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section === 'birthdays' && (
                    <div className="space-y-2">
                      <h5 className="flex items-center font-semibold text-pink-500"><Cake className="w-4 h-4 mr-2" /> Aniversariantes ({birthdayCount})</h5>
                      <div className="grid gap-2">
                        {birthdayClients?.map((client) => (
                          <div key={client.nome} className="grid gap-1 text-sm p-2 rounded-md bg-secondary">
                            <p className="font-medium leading-none">{client.nome}</p>
                            <p className="text-xs text-muted-foreground flex items-center">
                              <Phone className="w-3 h-3 mr-2" /> {client.whatsapp || "Sem telefone"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Adiciona Separator se não for a última seção */}
                  {index < visibleSections.length - 1 && <Separator />}
                </div>
              ))}

              {totalCount === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma notificação no momento.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}