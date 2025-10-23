import { NavLink, useNavigate } from "react-router-dom";
import { Home, Users, MessageSquare, Settings, LogOut, ClipboardList, History, ChefHat, LayoutDashboard, SquareKanban, Table as TableIcon, UserCog, UtensilsCrossed, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";

const allNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ['superadmin', 'admin', 'gerente', 'balcao'] },
  { to: "/", icon: Home, label: "Salão", roles: ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'] },
  { to: "/clientes", icon: Users, label: "Clientes", roles: ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'] },
  { to: "/produtos", icon: ClipboardList, label: "Cardápio", roles: ['superadmin', 'admin', 'gerente', 'balcao'] },
  { to: "/mesas", icon: TableIcon, label: "Gerenciar Mesas", roles: ['superadmin', 'admin', 'gerente', 'balcao', 'garcom'] },
  { to: "/cozinha", icon: ChefHat, label: "Cozinha", roles: ['superadmin', 'admin', 'gerente', 'cozinha', 'garcom'] },
  { to: "/cozinheiros", icon: UtensilsCrossed, label: "Gerenciar Cozinheiros", roles: ['superadmin', 'admin', 'gerente'] },
  { to: "/historico", icon: History, label: "Pedidos Fechados", roles: ['superadmin', 'admin', 'gerente'] },
  { to: "/gorjetas", icon: DollarSign, label: "Gorjetas", roles: ['superadmin', 'admin', 'gerente'] },
  { to: "/mensagens", icon: MessageSquare, label: "Mensagens", roles: ['superadmin', 'admin', 'gerente'] },
  { to: "/usuarios", icon: UserCog, label: "Gerenciar Usuários", roles: ['superadmin'] },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { userRole, isLoading } = useSettings();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (isLoading) {
    return null;
  }

  const filteredNavItems = allNavItems.filter(item => item.roles.includes(userRole!));

  return (
    <aside className="w-64 bg-card border-r flex flex-col text-foreground shrink-0 shadow-2xl">
      <div className="p-4 border-b border-border h-16 flex items-center">
        <SquareKanban className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-serif font-bold text-center ml-2 tracking-wider">Fidelize</h1>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/" || item.to === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-all duration-200",
                "hover:bg-secondary hover:text-foreground",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" 
                  : "hover:border-l-4 hover:border-primary/50"
              )
            }
          >
            <div className="flex items-center">
              <item.icon className="w-5 h-5 mr-3" />
              <span>{item.label}</span>
            </div>
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-border">
        {/* Restringindo o acesso a Configurações no Sidebar */}
        {userRole && ['superadmin', 'admin'].includes(userRole) && (
          <NavLink to="/configuracoes" className={({ isActive }) => cn("flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground transition-all duration-200", isActive ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "hover:bg-secondary hover:text-foreground hover:border-l-4 hover:border-primary/50")}>
              <div className="flex items-center"><Settings className="w-5 h-5 mr-3" /><span>Configurações</span></div>
          </NavLink>
        )}
        <Button variant="ghost" className="w-full justify-start mt-1 text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={handleLogout}>
          <LogOut className="w-5 h-5 mr-3" />
          <span>Sair</span>
        </Button>
      </div>
    </aside>
  );
}