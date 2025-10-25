"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KitchenKanban } from "@/components/kitchen/KitchenKanban";
import { DeliveryKanban } from "@/components/kitchen/DeliveryKanban";
import { CookPerformanceReport } from "@/components/cozinha/CookPerformanceReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, BarChart2 } from "lucide-react";
import { usePageActions } from "@/contexts/PageActionsContext";
import { showSuccess } from "@/utils/toast";

export default function Cozinha() {
  const queryClient = useQueryClient();
  const { setPageActions } = usePageActions();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["kitchenItems"] });
    queryClient.invalidateQueries({ queryKey: ["deliveryKitchenItems"] });
    queryClient.invalidateQueries({ queryKey: ["cookPerformanceStats"] });
    queryClient.invalidateQueries({ queryKey: ["cookDetails"] });
    showSuccess("Dados da cozinha atualizados!");
  };

  useEffect(() => {
    const pageActions = (
      <Button variant="outline" size="sm" onClick={handleRefresh} className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Atualizar
      </Button>
    );
    setPageActions(pageActions);

    return () => {
      setPageActions(null);
    };
  }, [setPageActions]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold">Cozinha</h1>
        <p className="text-muted-foreground mt-1">Gerencie o preparo dos pedidos do salão e delivery.</p>
      </div>
      <Tabs defaultValue="kanban" className="flex-1 flex flex-col">
        <div className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="kanban">Salão</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="desempenho" className="flex items-center gap-1">
              <BarChart2 className="w-4 h-4" /> Desempenho
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="kanban" className="flex-1 overflow-auto">
          <KitchenKanban />
        </TabsContent>
        <TabsContent value="delivery" className="flex-1 overflow-auto">
          <DeliveryKanban />
        </TabsContent>
        <TabsContent value="desempenho" className="flex-1 overflow-auto p-1">
          <CookPerformanceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}