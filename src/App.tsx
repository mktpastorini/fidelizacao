import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import DeliveryPage from "./pages/Delivery"; // Importado
import CaixaPage from "./pages/Caixa"; // Importado
import SaidaPage from "./pages/Saida"; // Importado
import { PageActionsProvider } from "./contexts/PageActionsContext";
import { SplashCursor } from "./components/SplashCursor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <SplashCursor
            SIM_RESOLUTION={128}
            DYE_RESOLUTION={1440}
            CAPTURE_RESOLUTION={512}
            DENSITY_DISSIPATION={3.5}
            VELOCITY_DISSIPATION={2}
            PRESSURE={0.1}
            PRESSURE_ITERATIONS={20}
            CURL={3}
            SPLAT_RADIUS={0.2}
            SPLAT_FORCE={6000}
            SHADING={true}
            COLOR_UPDATE_SPEED={10}
            BACK_COLOR={{ r: 0.5, g: 0, b: 0 }}
            TRANSPARENT={true}
          />
          <Routes>
            <Route path="/menu-publico/:mesaId" element={
              <SettingsProvider>
                <MenuPublicoPage />
              </SettingsProvider>
            } />
            
            <Route path="/login" element={<Login />} />
            
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
                <Route path="/dashboard" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao']}><DashboardPage /></RoleGuard>} />
                <Route path="/" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><SalaoPage /></RoleGuard>} />
                <Route path="/caixa" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao']}><CaixaPage /></RoleGuard>} />
                <Route path="/saida" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><SaidaPage /></RoleGuard>} />
                <Route path="/clientes" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><Clientes /></RoleGuard>} />
                <Route path="/produtos" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao']}><Produtos /></RoleGuard>} />
                <Route path="/mesas" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao', 'garcom']}><Mesas /></RoleGuard>} />
                <Route path="/cozinha" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'cozinha', 'garcom']}><Cozinha /></RoleGuard>} />
                <Route path="/cozinheiros" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><CozinheirosPage /></RoleGuard>} />
                <Route path="/historico" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><Historico /></RoleGuard>} />
                <Route path="/gorjetas" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'garcom']}><GorjetasPage /></RoleGuard>} />
                <Route path="/mensagens" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente']}><Mensagens /></RoleGuard>} />
                <Route path="/delivery" element={<RoleGuard allowedRoles={['superadmin', 'admin', 'gerente', 'balcao']}><DeliveryPage /></RoleGuard>} />
                <Route path="/configuracoes" element={<RoleGuard allowedRoles={['superadmin', 'admin']}><Configuracoes /></RoleGuard>} />
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