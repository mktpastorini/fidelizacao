import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  progress?: number;
};

export function StatCard({ title, value, icon: Icon, progress }: StatCardProps) {
  return (
    <Card className="bg-card shadow-lg border-border/50 transition-all hover:shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {progress !== undefined && (
          <div className="mt-4">
            <Progress value={progress} className="h-2" indicatorClassName="bg-primary" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}