import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Dock } from "./Dock";
import { useSettings } from "@/contexts/SettingsContext";
import { Skeleton } from "./ui/skeleton";
import { Header } from "./Header";

const MainContent = () => (
  <main className="flex-1 p-6 lg:p-8 overflow-y-auto relative">
    <Header />
    <Outlet />
  </main>
);

const DockContent = () => (
  // Ocupa todo o espaço vertical disponível, permitindo rolagem interna
  <main className="flex-1 p-6 lg:p-8 pb-24 relative overflow-y-auto">
    <Header />
    <Outlet />
  </main>
);

export function Layout() {
  const { settings, isLoading } = useSettings();

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (settings?.menu_style === 'dock') {
    return (
      // Contêiner flexível para o layout de dock
      <div className="relative flex flex-col h-screen bg-background">
        <DockContent /> {/* Conteúdo principal com rolagem */}
        <Dock /> {/* Dock fixo na parte inferior */}
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