import { UseFormReturn } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MultiImageCapture } from "@/components/clientes/MultiImageCapture";
import { Cliente } from "@/types/supabase";

interface StepProps {
  form: UseFormReturn<any>;
  onDuplicateFound: (cliente: Cliente) => void;
}

export function Step1_Photos({ form, onDuplicateFound }: StepProps) {
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
              onDuplicateFound={onDuplicateFound}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}