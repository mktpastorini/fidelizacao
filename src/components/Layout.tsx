import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}