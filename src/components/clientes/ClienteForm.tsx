import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Cliente, Filho } from "@/types/supabase";
import { Stepper } from "./stepper/Stepper";
import { Step1_Photos } from "./stepper/Step1_Photos";
import { Step2_BasicInfo } from "./stepper/Step2_BasicInfo";
import { Step3_Details } from "./stepper/Step3_Details";
import { Step4_Address } from "./stepper/Step4_Address";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome é obrigatório." }),
  casado_com: z.string().optional(),
  whatsapp: z.string().optional(),
  data_nascimento: z.string().optional().nullable(),
  avatar_urls: z.array(z.string()).min(1, { message: "É necessário pelo menos uma foto para o reconhecimento." }),
  indicado_por_id: z.string().uuid().optional().nullable().or(z.literal("none")).transform(val => val === "none" ? null : val),
  gostos: z.object({
    pizza_favorita: z.string().optional(),
    bebida_favorita: z.string().optional(),
    apos_comer: z.string().optional(),
  }).optional(),
  filhos: z.array(
    z.object({
      nome: z.string().min(1, { message: "Nome do filho é obrigatório." }),
      idade: z.coerce.number().positive().int().optional().nullable(),
    })
  ).optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_neighborhood: z.string().optional(),
  address_city: z.string().optional(),
  address_zip: z.string().optional(),
  address_complement: z.string().optional(),
});

type ClienteFormProps = {
  onSubmit: (values: z.infer<typeof formSchema> & { avatar_url?: string | null }) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<Cliente & { filhos: Filho[] }>;
  clientes: Cliente[];
  isEditing?: boolean;
};

const steps = ["Fotos", "Informações", "Detalhes", "Endereço"];
const fieldGroups = [
  ["avatar_urls"],
  ["nome", "whatsapp", "data_nascimento", "casado_com"],
  ["indicado_por_id", "gostos", "filhos"],
  ["address_street", "address_number", "address_neighborhood", "address_city", "address_zip", "address_complement"],
];

export function ClienteForm({ onSubmit, isSubmitting, defaultValues, clientes, isEditing }: ClienteFormProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      nome: defaultValues?.nome || "",
      casado_com: defaultValues?.casado_com || "",
      whatsapp: defaultValues?.whatsapp || "",
      data_nascimento: defaultValues?.data_nascimento || undefined,
      avatar_urls: defaultValues?.avatar_url ? [defaultValues.avatar_url] : [],
      indicado_por_id: defaultValues?.indicado_por_id || "none",
      gostos: {
        pizza_favorita: defaultValues?.gostos?.pizza_favorita || "",
        bebida_favorita: defaultValues?.gostos?.bebida_favorita || "",
        apos_comer: defaultValues?.gostos?.apos_comer || "",
      },
      filhos: defaultValues?.filhos || [],
      address_street: defaultValues?.address_street || "",
      address_number: defaultValues?.address_number || "",
      address_neighborhood: defaultValues?.address_neighborhood || "",
      address_city: defaultValues?.address_city || "",
      address_zip: defaultValues?.address_zip || "",
      address_complement: defaultValues?.address_complement || "",
    },
  });

  const handleNext = async () => {
    const fieldsToValidate = fieldGroups[currentStep];
    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    const submissionData = {
      ...values,
      avatar_url: values.avatar_urls[0] || null,
    };
    onSubmit(submissionData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <Stepper steps={steps} currentStep={currentStep} />

        <div className="min-h-[300px]">
          {currentStep === 0 && <Step1_Photos form={form} />}
          {currentStep === 1 && <Step2_BasicInfo form={form} />}
          {currentStep === 2 && <Step3_Details form={form} clientes={clientes} isEditing={isEditing} />}
          {currentStep === 3 && <Step4_Address form={form} />}
        </div>

        <div className="flex justify-between pt-4">
          {currentStep > 0 ? (
            <Button type="button" variant="outline" onClick={handleBack}>
              Voltar
            </Button>
          ) : <div />}
          
          {currentStep < steps.length - 1 ? (
            <Button type="button" onClick={handleNext}>
              Avançar
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Cliente"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}