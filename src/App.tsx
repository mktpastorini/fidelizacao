import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthLayout } from "./components/AuthLayout";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./components/ThemeProvider";
import { RoleGuard } from "./components/RoleGuard";
import DashboardPage from "./pages/Dashboard";
import SalaoPage from "./pages/Salao";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import Mensagens from "./pages/Mensagens";
import Mesas from "./pages/Mesas";
import Cozinha from "./pages/Cozinha";
import Historico from "./pages/Historico";
import Configuracoes from "./pages/Configuracoes";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import MenuPublicoPage from "./pages/MenuPublico";
import UsuariosPage from "./pages/Usuarios";
import CozinheirosPage from "./pages/Cozinheiros";
import GorjetasPage from "./pages/Gorjetas";
import { PageActionsProvider } from "./contexts/PageActionsContext";
import InstallationPage from "./pages/InstallationPage";
import { useInstaller } from "./hooks/useInstaller";
import { Skeleton } from "./components/ui/skeleton";

const queryClient = new QueryClient();

// Componente Wrapper para verificar o status da instalação
const InstallationWrapper = () => {
  const { isInstalled, isLoading } = useInstaller();

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (!isInstalled) {
    return <InstallationPage />;
  }
  
  // Se instalado, permite o fluxo normal de autenticação
  return (
    <SettingsProvider>
      <AuthLayout />
    </SettingsProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rota Pública para o Menu */}
            <Route path="/menu-publico/:mesaId" element={
              <SettingsProvider>
                <MenuPublicoPage />
              </SettingsProvider>
            } />
            
            {/* Rota de Login (Acessível mesmo se não estiver instalado, mas redireciona se não estiver) */}
            <Route path="/login" element={<Login />} />
            
            {/* Rota de Instalação (Ponto de entrada principal) */}
            <Route path="/install" element={<InstallationPage />} />
            
            {/* Rotas Protegidas (Envolvidas pelo InstallationWrapper) */}
            <Route element={<InstallationWrapper />}>
              <Route element={
                <PageActionsProvider>
                  <Layout />
                </PageActionsProvider>
              }>
                {/* Rotas com RoleGuard */}
                <Route path="/dashboard" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao']}><DashboardPage /></RoleGuard>} />
                <Route path="/" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><SalaoPage /></RoleGuard>} />
                <Route path="/clientes" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><Clientes /></RoleGuard>} />
                <Route path="/produtos" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao']}><Produtos /></RoleGuard>} />
                <Route path="/mesas" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><Mesas /></RoleGuard>} />
                <Route path="/cozinha" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'cozinha', 'garcom']}><Cozinha /></RoleGuard>} />
                <Route path="/cozinheiros" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><CozinheirosPage /></RoleGuard>} />
                <Route path="/historico" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><Historico /></RoleGuard>} />
                <Route path="/gorjetas" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'garcom']}><GorjetasPage /></RoleGuard>} />
                <Route path="/mensagens" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><Mensagens /></RoleGuard>} />
                <Route path="/configuracoes" element={<RoleGuard allowedRoles={['superadmin', 'admin']}><Configuracoes /></RoleGuard>} />
                <Route path="/usuarios" element={<RoleGuard allowedRoles={['superadmin']}><UsuariosPage /></RoleGuard>} />
                
                {/* Redirecionamento da raiz para a página principal se instalado */}
                <Route path="/" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;