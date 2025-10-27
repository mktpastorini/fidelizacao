import { Outlet, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { DockMenu } from "../DockMenu";
import { useSettings } from "@/contexts/SettingsContext";

export function Layout() {
  const { settings } = useSettings();
  const location = useLocation();
  const menuStyle = settings?.menu_style || 'sidebar';

  const isCaixaPage = location.pathname === '/caixa';

  // Renderiza um layout simplificado sem header/menu para a página do caixa
  if (isCaixaPage) {
    return (
      <div className="min-h-screen w-full bg-background">
        <main className="flex-1 h-screen">
          <Outlet />
        </main>
      </div>
    );
  }

  // Renderiza o layout padrão para todas as outras páginas
  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {menuStyle === 'sidebar' && <Sidebar />}
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 flex-grow">
        <Header />
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          <Outlet />
        </main>
      </div>
      {menuStyle === 'dock' && <DockMenu />}
    </div>
  );
}