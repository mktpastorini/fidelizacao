import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Dock } from "./Dock";
import { useSettings } from "@/contexts/SettingsContext";
import { Skeleton } from "./ui/skeleton";
import { Header } from "./Header";
import { PageActionsProvider } from "@/contexts/PageActionsContext";
import React from "react";

const MainContent = () => (
  <PageActionsProvider>
    <main className="flex-1 p-6 lg:p-8 overflow-y-auto relative">
      <Header />
      <Outlet />
    </main>
  </PageActionsProvider>
);

const DockContent = () => (
  <PageActionsProvider>
    <main className="flex-1 p-6 lg:p-8 pb-24 relative overflow-y-auto">
      <Header />
      <Outlet />
    </main>
  </PageActionsProvider>
);

export function Layout() {
  const { settings, isLoading } = useSettings();

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (settings?.menu_style === 'dock') {
    return (
      <div className="relative flex flex-col h-screen bg-background">
        <DockContent />
        <Dock />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <MainContent />
    </div>
  );
}