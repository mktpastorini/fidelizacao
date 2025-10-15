import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthLayout } from "./components/AuthLayout";
import { SettingsProvider } from "./contexts/SettingsContext";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AuthLayout />}>
            <SettingsProvider>
              <Layout />
            </SettingsProvider>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;