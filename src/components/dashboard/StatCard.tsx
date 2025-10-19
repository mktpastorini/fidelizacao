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
  const colorClasses = {
    blue: "text-blue-500 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    orange: "text-orange-500 dark:text-orange-400",
    purple: "text-purple-600 dark:text-purple-400",
  };
  
  const iconColor = colorClasses[variant];

  // Para o valor, usamos a cor de destaque, exceto para o kitchenValue que já tem cores internas
  const valueColor = variant === 'purple' ? 'text-foreground' : iconColor;

  return (
    <Card className="border shadow-md transition-all hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold", valueColor)}>{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}