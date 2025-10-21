import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthLayout } from "./components/AuthLayout";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./components/ThemeProvider";
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
import MenuPublicoPage from "./pages/MenuPublico"; // Importando a página do menu público
import { PageActionsProvider } from "./contexts/PageActionsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rota Pública para o Menu */}
            <Route path="/menu-publico/:mesaId" element={<MenuPublicoPage />} />
            
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;