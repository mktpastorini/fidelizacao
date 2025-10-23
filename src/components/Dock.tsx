"use client";

import * as React from "react";
import { motion, useMotionValue } from "framer-motion";
import { DockIcon } from "./DockIcon";
import {
  LayoutDashboard,
  Home,
  Users,
  ClipboardList,
  Table as TableIcon,
  ChefHat,
  History,
  MessageSquare,
  Settings,
  LogOut,
  UserCog,
  UtensilsCrossed,
  DollarSign, // Importado
} from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext"; // Importando useSettings

const allNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ['superadmin', 'admin', 'gerente', 'balcao'] },
  { to: "/", icon: Home, label: "Salão", roles: ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'] },
  { to: "/clientes", icon: Users, label: "Clientes", roles: ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'] },
  { to: "/produtos", icon: ClipboardList, label: "Cardápio", roles: ['superadmin', 'admin', 'gerente', 'balcao'] },
  { to: "/mesas", icon: TableIcon, label: "Gerenciar Mesas", roles: ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'] },
  { to: "/cozinha", icon: ChefHat, label: "Cozinha", roles: ['superadmin', 'admin', 'gerente', 'cozinha', 'garcom'] },
  { to: "/cozinheiros", icon: UtensilsCrossed, label: "Gerenciar Cozinheiros", roles: ['superadmin', 'admin', 'gerente'] },
  { to: "/historico", icon: History, label: "Pedidos Fechados", roles: ['superadmin', 'admin', 'gerente'] },
  { to: "/gorjetas", icon: DollarSign, label: "Gorjetas", roles: ['superadmin', 'admin', 'gerente'] }, // NOVO
  { to: "/mensagens", icon: MessageSquare, label: "Mensagens", roles: ['superadmin', 'admin', 'gerente'] },
  { to: "/configuracoes", icon: Settings, label: "Configurações", roles: ['superadmin', 'admin'] },
  { to: "/usuarios", icon: UserCog, label: "Gerenciar Usuários", roles: ['superadmin'] },
];

export function Dock() {
  const mouseX = useMotionValue(Infinity);
  const navigate = useNavigate();
  const { userRole, isLoading } = useSettings();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Filtra os itens de navegação com base na função do usuário
  const navItems = React.useMemo(() => {
    if (isLoading || !userRole) return [];
    return allNavItems.filter(item => item.roles.includes(userRole));
  }, [userRole, isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex h-16 items-end gap-3 rounded-2xl bg-card/80 backdrop-blur-md px-4 pb-3 border shadow-dock"
      >
        {navItems.map((item) => (
          <DockIcon key={item.to} mouseX={mouseX} item={item} />
        ))}
        <div className="w-px h-8 bg-border mx-2" />
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-10 h-10 rounded-full bg-secondary/50 hover:bg-secondary" 
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 text-muted-foreground" />
        </Button>
      </motion.div>
    </div>
  );
}