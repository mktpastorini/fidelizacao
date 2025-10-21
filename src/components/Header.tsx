import { NotificationCenter } from "./NotificationCenter";
import { ThemeToggle } from "./ThemeToggle";
import { usePageActions } from "@/contexts/PageActionsContext";
import React from "react";

export function Header() {
  const { pageActions } = usePageActions();

  return (
    <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-10 flex flex-row-reverse flex-nowrap items-center gap-4 max-w-full">
      <NotificationCenter />
      <ThemeToggle />
      {pageActions}
    </div>
  );
}