import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Dock } from "./Dock";
import { useSettings } from "@/contexts/SettingsContext";
import { Skeleton } from "./ui/skeleton";

export function Layout() {
  const { settings, isLoading } = useSettings();

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (settings?.menu_style === 'dock') {
    return (
      <div className="relative min-h-screen bg-background">
        <main className="p-6 lg:p-8 pb-24">
          <Outlet />
        </main>
        <Dock />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}