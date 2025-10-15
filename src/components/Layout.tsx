import { Outlet, Routes, Route } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Dock } from "./Dock";
import { useSettings } from "@/contexts/SettingsContext";
import { Skeleton } from "./ui/skeleton";
import DashboardPage from "@/pages/Dashboard";
import SalaoPage from "@/pages/Salao";
import Clientes from "@/pages/Clientes";
import Produtos from "@/pages/Produtos";
import Mensagens from "@/pages/Mensagens";
import Mesas from "@/pages/Mesas";
import Cozinha from "@/pages/Cozinha";
import Historico from "@/pages/Historico";
import Configuracoes from "@/pages/Configuracoes";

const SidebarLayout = () => (
  <div className="flex min-h-screen bg-background">
    <Sidebar />
    <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
      <Outlet />
    </main>
  </div>
);

const DockLayout = () => (
  <div className="relative min-h-screen bg-background">
    <main className="p-6 lg:p-8 pb-24">
      <Outlet />
    </main>
    <Dock />
  </div>
);

export function Layout() {
  const { settings, isLoading } = useSettings();

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  const LayoutComponent = settings?.menu_style === 'dock' ? DockLayout : SidebarLayout;

  return (
    <Routes>
      <Route element={<LayoutComponent />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/" element={<SalaoPage />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/mesas" element={<Mesas />} />
        <Route path="/cozinha" element={<Cozinha />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/mensagens" element={<Mensagens />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
    </Routes>
  );
}