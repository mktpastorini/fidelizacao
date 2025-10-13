import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 bg-gray-50/50 dark:bg-gray-900/50">
        <Outlet />
      </main>
    </div>
  );
}