import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

type StatCardProps = {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  variant: 'blue' | 'green' | 'orange' | 'purple';
  description?: string;
};

export function StatCard({ title, value, icon: Icon, variant, description }: StatCardProps) {
  const variantClasses = {
    blue: "bg-gradient-to-br from-blue-600 to-blue-800 text-blue-50",
    green: "bg-gradient-to-br from-green-600 to-green-800 text-green-50",
    orange: "bg-gradient-to-br from-orange-500 to-orange-700 text-orange-50",
    purple: "bg-gradient-to-br from-purple-600 to-purple-800 text-purple-50",
  };

  return (
    <Card className={cn("border-none text-white shadow-lg", variantClasses[variant])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-current/80" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description && <p className="text-xs text-current/80 pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}