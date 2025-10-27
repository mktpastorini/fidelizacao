import { usePerformance } from '@/contexts/PerformanceContext';
import { Button } from '@/components/ui/button';
import { Timer } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function PerformanceToggle() {
  const { isPerformanceModeEnabled, togglePerformanceMode } = usePerformance();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={togglePerformanceMode}
          className={cn(isPerformanceModeEnabled && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
        >
          <Timer className={cn("h-[1.2rem] w-[1.2rem]", isPerformanceModeEnabled ? "text-primary" : "text-muted-foreground")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isPerformanceModeEnabled ? "Desativar" : "Ativar"} Medidor de Performance</p>
      </TooltipContent>
    </Tooltip>
  );
}