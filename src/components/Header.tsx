import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { usePageActions } from "@/contexts/PageActionsContext";
import React from "react";

export function Header() {
  const { pageActions } = usePageActions();

  return (
    <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-10 flex flex-row-reverse flex-nowrap items-center gap-4 max-w-full">
      {/* 
        1. pageActions (botões da sessão)
        2. NotificationCenter (sininho)
        3. ThemeToggle (modo escuro)
        
        Com flex-row-reverse, a ordem visual será:
        [ThemeToggle] [NotificationCenter] [pageActions]
        
        Como o container está alinhado à direita (right-6), eles aparecerão da direita para a esquerda.
      */}
      <ThemeToggle />
      <NotificationCenter />
      {/* Envolve pageActions em um div para garantir que o gap funcione corretamente */}
      <div className="flex items-center gap-4">
        {pageActions}
      </div>
    </div>
  );
}