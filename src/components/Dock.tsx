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
} from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/", icon: Home, label: "Salão" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/produtos", icon: ClipboardList, label: "Cardápio" },
  { to: "/mesas", icon: TableIcon, label: "Gerenciar Mesas" },
  { to: "/cozinha", icon: ChefHat, label: "Cozinha" },
  { to: "/historico", icon: History, label: "Pedidos Fechados" },
  { to: "/mensagens", icon: MessageSquare, label: "Mensagens" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

export function Dock() {
  const mouseX = useMotionValue(Infinity);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex h-16 items-end gap-3 rounded-2xl bg-card/80 backdrop-blur-md px-4 pb-3 border"
      >
        {navItems.map((item) => (
          <DockIcon key={item.to} mouseX={mouseX} item={item} />
        ))}
        <div className="w-px h-8 bg-border mx-2" />
        <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full bg-secondary/50" onClick={handleLogout}>
          <LogOut className="w-5 h-5 text-muted-foreground" />
        </Button>
      </motion.div>
    </div>
  );
}