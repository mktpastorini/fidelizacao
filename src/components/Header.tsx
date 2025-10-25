"use client";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ApprovalRequestsDialog } from "@/components/Notification/ApprovalRequestsDialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { NewDeliveryOrderDialog } from "@/components/delivery/NewDeliveryOrderDialog";

type HeaderProps = {
  pageActions?: React.ReactNode;
};

export function Header({ pageActions }: HeaderProps) {
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-10 flex flex-row-reverse flex-nowrap items-center gap-4 max-w-full">
        {/* 
          Ordem visual (direita para esquerda):
          [ThemeToggle] [NotificationCenter] [ApprovalRequestsDialog] [pageActions]
        */}
        <ThemeToggle />
        <NotificationCenter />
        <ApprovalRequestsDialog />
        
        {location.pathname === '/' && (
          <Button onClick={() => setIsDeliveryDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo pedido Delivery
          </Button>
        )}

        {pageActions && <div className="hidden lg:flex items-center gap-4">{pageActions}</div>}
      </div>
      <NewDeliveryOrderDialog isOpen={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen} />
    </>
  );
}