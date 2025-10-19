import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Phone, PackageWarning, Cake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LowStockProduct } from "@/types/supabase";
import { Separator } from "@/components/ui/separator";

type BirthdayClient = {
  nome: string;
  whatsapp: string | null;
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

export function NotificationCenter() {
  const { data: birthdayClients } = useQuery({
    queryKey: ["todays_birthdays"],
    queryFn: fetchTodaysBirthdays,
    refetchInterval: 60000, // Refetch every minute
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["low_stock_products"],
    queryFn: fetchLowStockProducts,
    refetchInterval: 60000, // Refetch every minute
  });

  const birthdayCount = birthdayClients?.length || 0;
  const lowStockCount = lowStockProducts?.length || 0;
  const totalCount = birthdayCount + lowStockCount;

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
          
          {/* Alertas de Estoque Baixo */}
          {lowStockCount > 0 && (
            <>
              <div className="space-y-2">
                <h5 className="flex items-center font-semibold text-warning"><PackageWarning className="w-4 h-4 mr-2" /> Estoque Baixo ({lowStockCount})</h5>
                <div className="grid gap-2">
                  {lowStockProducts?.map((product) => (
                    <div key={product.id} className="grid gap-1 text-sm">
                      <p className="font-medium leading-none">{product.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Estoque: {product.estoque_atual} (Alerta em: {product.alerta_estoque_baixo})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {birthdayCount > 0 && <Separator />}
            </>
          )}

          {/* Alertas de Aniversário */}
          {birthdayCount > 0 && (
            <div className="space-y-2">
              <h5 className="flex items-center font-semibold text-primary"><Cake className="w-4 h-4 mr-2" /> Aniversariantes ({birthdayCount})</h5>
              <div className="grid gap-2">
                {birthdayClients?.map((client) => (
                  <div key={client.nome} className="grid gap-1 text-sm">
                    <p className="font-medium leading-none">{client.nome}</p>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <Phone className="w-3 h-3 mr-2" /> {client.whatsapp || "Sem telefone"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalCount === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma notificação no momento.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}