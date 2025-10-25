import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MultiImageCapture } from "@/components/clientes/MultiImageCapture";

interface StepProps {
  form: UseFormReturn<any>;
}

export function Step1_Photos({ form }: StepProps) {
  return (
    <FormField
      control={form.control}
      name="avatar_urls"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Fotos do Cliente</FormLabel>
          <FormControl>
            <MultiImageCapture
              urls={field.value || []}
              onUrlsChange={field.onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}