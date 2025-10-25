import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Dock } from "./Dock";
import { useSettings } from "@/contexts/SettingsContext";
import { Skeleton } from "./ui/skeleton";
import { Header } from "./Header";
import { usePageActions } from "@/contexts/PageActionsContext";

const MainContent = () => {
  const { pageActions } = usePageActions();
  return (
    // O overflow-y-auto aqui garante que apenas o conteúdo principal role
    <main className="flex-1 p-6 lg:p-8 pt-20 pr-28 overflow-y-auto relative bg-secondary/50">
      <Header pageActions={pageActions} />
      <Outlet />
    </main>
  );
};

const DockContent = () => {
  const { pageActions } = usePageActions();
  return (
    // Ocupa todo o espaço vertical disponível, permitindo rolagem interna
    <main className="flex-1 p-6 lg:p-8 pb-32 pt-20 pr-28 relative overflow-y-auto bg-secondary/50">
      <Header pageActions={pageActions} />
      <Outlet />
    </main>
  );
};

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
    <div className="flex h-screen bg-background"> {/* Usando h-screen em vez de min-h-screen */}
      <Sidebar />
      <MainContent />
    </div>
  );
}