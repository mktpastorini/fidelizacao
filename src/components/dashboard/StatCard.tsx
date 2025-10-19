import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subData?: { name: string; value: number }[];
  colorClass: 'text-primary' | 'text-success' | 'text-warning' | 'text-destructive';
  subValue?: string | number;
};

export function StatCard({ title, value, icon: Icon, subData, colorClass, subValue }: StatCardProps) {
  const barColor = colorClass.replace('text-', 'var(--');
  
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-5 w-5", colorClass)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold", colorClass)}>{value}</div>
        {subData && (
          <div className="mt-4 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar 
                  dataKey="value" 
                  fill={`hsl(${barColor})`} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {subValue && (
          <p className="text-sm text-muted-foreground mt-2">{subValue}</p>
        )}
      </CardContent>
    </Card>
  );
}