import { NavLink, useNavigate } from "react-router-dom";
import { Home, Users, MessageSquare, Settings, Table, LogOut, ClipboardList, History, BarChart2, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", icon: Home, label: "Dashboard" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/produtos", icon: ClipboardList, label: "Produtos" },
  { to: "/mesas", icon: Table, label: "Mesas" },
  { to: "/cozinha", icon: ChefHat, label: "Cozinha" },
  { to: "/historico", icon: History, label: "Histórico" },
  { to: "/relatorios", icon: BarChart2, label: "Relatórios" },
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
    <aside className="w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold text-center">Fidelize</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800",
                isActive && "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
              )
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="w-5 h-5 mr-3" />
          <span>Sair</span>
        </Button>
      </div>
    </aside>
  );
}