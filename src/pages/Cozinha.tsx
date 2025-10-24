"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { KitchenKanban } from "@/components/kitchen/KitchenKanban";
import { DeliveryKanban } from "@/components/kitchen/DeliveryKanban";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function Cozinha() {
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const handleRefresh = () => {
    setLastRefreshed(new Date());
  };

  const pageActions = (
    <Button variant="outline" size="sm" onClick={handleRefresh} className="flex items-center gap-2">
      <RefreshCw className="w-4 h-4" />
      Atualizar
    </Button>
  );

  return (
    <div className="flex flex-col h-screen bg-muted/40">
      <Header title="Cozinha" pageActions={pageActions} />
      <main className="flex-1 flex flex-col p-4 md:p-6">
        <Tabs defaultValue="kanban" className="flex-1 flex flex-col">
          <div className="mb-4">
            <TabsList>
              <TabsTrigger value="kanban">Salão</TabsTrigger>
              <TabsTrigger value="delivery">Delivery</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="kanban" className="flex-1 overflow-auto">
            <KitchenKanban key={lastRefreshed.toISOString()} />
          </TabsContent>
          <TabsContent value="delivery" className="flex-1 overflow-auto">
            <DeliveryKanban key={lastRefreshed.toISOString()} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}