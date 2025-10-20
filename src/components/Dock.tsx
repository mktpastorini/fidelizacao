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
import { ScrollArea, ScrollBar } from "./ui/scroll-area"; // Importando ScrollArea

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
    <div className="fixed bottom-0 left-0 right-0 flex justify-center z-50 p-2 sm:p-4">
      <ScrollArea className="w-full max-w-full sm:max-w-4xl">
        <motion.div
          onMouseMove={(e) => mouseX.set(e.pageX)}
          onMouseLeave={() => mouseX.set(Infinity)}
          className="flex h-16 items-end gap-3 rounded-2xl bg-card/80 backdrop-blur-md px-4 pb-3 border w-max mx-auto"
        >
          {navItems.map((item) => (
            <DockIcon key={item.to} mouseX={mouseX} item={item} />
          ))}
          <div className="w-px h-8 bg-border mx-2 shrink-0" />
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full bg-secondary/50 shrink-0" onClick={handleLogout}>
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </motion.div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
}