import { Outlet } from "react-router-dom";
import { Dock } from "./Dock";

export function Layout() {
  return (
    <div className="relative min-h-screen bg-background">
      <main className="p-6 lg:p-8 pb-24">
        <Outlet />
      </main>
      <Dock />
    </div>
  );
}