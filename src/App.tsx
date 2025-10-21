import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthLayout } from "./components/AuthLayout";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./components/ThemeProvider";
import { RoleGuard } from "./components/RoleGuard"; // Importado RoleGuard
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
import UsuariosPage from "./pages/Usuarios"; // IMPORTADO
import { PageActionsProvider } from "./contexts/PageActionsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rota Pública para o Menu, agora envolvida por SettingsProvider */}
            <Route path="/menu-publico/:mesaId" element={
              <SettingsProvider>
                <MenuPublicoPage />
              </SettingsProvider>
            } />
            
            {/* Rotas de Autenticação */}
            <Route path="/login" element={<Login />} />
            
            {/* Rotas Protegidas */}
            <Route
              element={
                <SettingsProvider>
                  <AuthLayout />
                </SettingsProvider>
              }
            >
              <Route element={
                <PageActionsProvider>
                  <Layout />
                </PageActionsProvider>
              }>
                {/* Rotas com RoleGuard */}
                <Route path="/dashboard" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom', 'cozinha']}><DashboardPage /></RoleGuard>} />
                <Route path="/" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><SalaoPage /></RoleGuard>} />
                <Route path="/clientes" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><Clientes /></RoleGuard>} />
                <Route path="/produtos" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao']}><Produtos /></RoleGuard>} />
                <Route path="/mesas" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><Mesas /></RoleGuard>} />
                <Route path="/cozinha" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'cozinha']}><Cozinha /></RoleGuard>} />
                <Route path="/historico" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><Historico /></RoleGuard>} />
                <Route path="/mensagens" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><Mensagens /></RoleGuard>} />
                <Route path="/configuracoes" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom', 'cozinha']}><Configuracoes /></RoleGuard>} />
                <Route path="/usuarios" element={<RoleGuard allowedRoles={['superadmin']}><UsuariosPage /></RoleGuard>} />
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