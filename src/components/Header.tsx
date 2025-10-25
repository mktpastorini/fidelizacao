"use client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ApprovalRequestsDialog } from "@/components/Notification/ApprovalRequestsDialog";

type HeaderProps = {
  pageActions?: React.ReactNode;
};

export function Header({ pageActions }: HeaderProps) {
  return (
    <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-10 flex flex-row-reverse flex-nowrap items-center gap-4 max-w-full">
      <ThemeToggle />
      <NotificationCenter />
      <ApprovalRequestsDialog />
      {pageActions && <div className="hidden lg:flex items-center gap-4">{pageActions}</div>}
    </div>
  );
}