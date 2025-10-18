import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type BirthdayClient = {
  nome: string;
  whatsapp: string | null;
};

async function fetchTodaysBirthdays(): Promise<BirthdayClient[]> {
  const { data, error } = await supabase.rpc('get_todays_birthdays');
  if (error) throw new Error(error.message);
  return data || [];
}

export function BirthdayNotifier() {
  const { data: birthdayClients } = useQuery({
    queryKey: ["todays_birthdays"],
    queryFn: fetchTodaysBirthdays,
    refetchInterval: 60000, // Refetch every minute
  });

  const count = birthdayClients?.length || 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {count > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">{count}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Aniversariantes de Hoje</h4>
            <p className="text-sm text-muted-foreground">
              Clientes comemorando aniversário hoje.
            </p>
          </div>
          <div className="grid gap-2">
            {count > 0 ? (
              birthdayClients?.map((client) => (
                <div key={client.nome} className="grid grid-cols-[25px_1fr] items-start pb-4 last:pb-0">
                  <span className="flex h-2 w-2 translate-y-1 rounded-full bg-sky-500" />
                  <div className="grid gap-1">
                    <p className="text-sm font-medium leading-none">{client.nome}</p>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Phone className="w-3 h-3 mr-2" /> {client.whatsapp || "Sem telefone"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversariante hoje.</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}