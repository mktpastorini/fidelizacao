import { NavLink, useNavigate } from "react-router-dom";
import { Home, Users, MessageSquare, Settings, Table, LogOut, ClipboardList, History, BarChart2, ChefHat, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/", icon: Home, label: "Salão" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/produtos", icon: ClipboardList, label: "Cardápio" },
  { to: "/mesas", icon: Table, label: "Gerenciar Mesas" },
  { to: "/cozinha", icon: ChefHat, label: "Cozinha" },
  { to: "/historico", icon: History, label: "Pedidos Fechados" },
  { to: "/mensagens", icon: MessageSquare, label: "Mensagens" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

export function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <aside className="w-64 bg-card border-r flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold text-center text-primary">Fidelize</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2 text-foreground/80 rounded-md text-sm font-medium hover:bg-secondary hover:text-foreground",
                isActive && "bg-primary/10 text-primary font-semibold"
              )
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="w-5 h-5 mr-3" />
          <span>Sair</span>
        </Button>
      </div>
    </aside>
  );
}