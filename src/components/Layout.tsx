import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Dock } from "./Dock";
import { useSettings } from "@/contexts/SettingsContext";
import { Skeleton } from "./ui/skeleton";
import { ThemeToggle } from "./ThemeToggle";

const MainContent = () => (
  <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
    <div className="flex justify-end mb-4">
      <ThemeToggle />
    </div>
    <Outlet />
  </main>
);

const DockContent = () => (
  <main className="p-6 lg:p-8 pb-24">
    <div className="flex justify-end mb-4">
      <ThemeToggle />
    </div>
    <Outlet />
  </main>
);

export function Layout() {
  const { settings, isLoading } = useSettings();

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (settings?.menu_style === 'dock') {
    return (
      <div className="relative min-h-screen bg-background">
        <DockContent />
        <Dock />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <MainContent />
    </div>
  );
}