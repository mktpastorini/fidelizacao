import { cn } from "@/lib/utils";

type StepperProps = {
  steps: string[];
  currentStep: number;
};

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center w-full">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                index <= currentStep ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}
            >
              {index + 1}
            </div>
            <p className={cn(
              "text-xs mt-1 text-center",
              index <= currentStep ? "font-semibold text-primary" : "text-muted-foreground"
            )}>
              {step}
            </p>
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              "flex-1 h-1 transition-colors",
              index < currentStep ? "bg-primary" : "bg-border"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}