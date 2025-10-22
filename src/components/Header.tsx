import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { usePageActions } from "@/contexts/PageActionsContext";
import React from "react";
import { ApprovalRequestsDialog } from "./Notification/ApprovalRequestsDialog"; // Importado

export function Header() {
  const { pageActions } = usePageActions();

  return (
    <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-10 flex flex-row-reverse flex-nowrap items-center gap-4 max-w-full">
      {/* 
        Ordem visual (direita para esquerda):
        [ThemeToggle] [NotificationCenter] [ApprovalRequestsDialog] [pageActions]
      */}
      <ThemeToggle />
      <NotificationCenter />
      <ApprovalRequestsDialog /> {/* Novo botão de aprovação */}
      {/* Envolve pageActions em um div para garantir que o gap funcione corretamente */}
      <div className="flex items-center gap-4">
        {pageActions}
      </div>
    </div>
  );
}