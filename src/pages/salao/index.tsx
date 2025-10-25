"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { MesaCard } from "@/components/mesas/MesaCard";
import { PedidoModal } from "@/components/mesas/PedidoModal";
import { NovaMesaDialog } from "@/components/mesas/NovaMesaDialog";
import { Button } from "@/components/ui/button";
import { PlusCircle, RefreshCw } from "lucide-react";
import { Mesa } from "@/types/supabase";
import { Skeleton } from "@/components/ui/skeleton";

const fetchMesas = async () => {
  const { data, error } = await supabase
    .from("mesas")
    .select("*, cliente:cliente_id(id, nome, avatar_url), ocupantes:mesa_ocupantes(cliente:clientes(id, nome, avatar_url))")
    .order("numero", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Mesa[];
};

export default function SalaoPage() {
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [isPedidoModalOpen, setIsPedidoModalOpen] = useState(false);
  const [isNovaMesaDialogOpen, setIsNovaMesaDialogOpen] = useState(false);

  const { data: mesas, isLoading, error, refetch } = useQuery({
    queryKey: ["salaoData"],
    queryFn: fetchMesas,
  });

  const handleMesaClick = (mesa: Mesa) => {
    setSelectedMesa(mesa);
    setIsPedidoModalOpen(true);
  };

  const pageActions = (
    <>
      <Button onClick={() => refetch()} variant="outline" size="icon">
        <RefreshCw className="h-4 w-4" />
      </Button>
      <Button onClick={() => setIsNovaMesaDialogOpen(true)}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Nova Mesa
      </Button>
    </>
  );

  return (
    <MainLayout pageTitle="Salão" pageActions={pageActions}>
      <div className="container mx-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-destructive">
            <p>Erro ao carregar as mesas: {error.message}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {mesas?.map((mesa) => (
              <MesaCard key={mesa.id} mesa={mesa} onClick={() => handleMesaClick(mesa)} />
            ))}
          </div>
        )}
      </div>

      {selectedMesa && (
        <PedidoModal
          isOpen={isPedidoModalOpen}
          onOpenChange={setIsPedidoModalOpen}
          mesa={selectedMesa}
        />
      )}

      <NovaMesaDialog isOpen={isNovaMesaDialogOpen} onOpenChange={setIsNovaMesaDialogOpen} />
    </MainLayout>
  );
}