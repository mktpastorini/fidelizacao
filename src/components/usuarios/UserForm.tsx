import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserRole } from "@/types/supabase";
import { Loader2 } from "lucide-react";

const ROLES: { value: UserRole, label: string }[] = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'balcao', label: 'Balcão' },
  { value: 'garcom', label: 'Garçom' },
  { value: 'cozinha', label: 'Cozinha' },
];

const baseSchema = z.object({
  first_name: z.string().min(1, "O nome é obrigatório."),
  last_name: z.string().optional(),
  role: z.enum(['superadmin', 'admin', 'gerente', 'balcao', 'garcom', 'cozinha']),
});

const createSchema = baseSchema.extend({
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

// Definindo o tipo base para o formulário
type UserFormValues = z.infer<typeof createSchema> & { id?: string };

type UserFormProps = {
  onSubmit: (values: any) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<UserFormValues>;
  isEditing: boolean;
};

export function UserForm({ onSubmit, isSubmitting, defaultValues, isEditing }: UserFormProps) {
  const schema = isEditing ? baseSchema : createSchema;
  
  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      // O ID é crucial para a edição, mas não faz parte do esquema de validação
      id: defaultValues?.id || "", 
      email: defaultValues?.email || "",
      password: "",
      first_name: defaultValues?.first_name || "",
      last_name: defaultValues?.last_name || "",
      role: defaultValues?.role || "garcom",
    },
  });

  const handleSubmit = (values: UserFormValues) => {
    if (isEditing) {
      // No modo de edição, o ID deve vir dos defaultValues, pois não é um campo renderizado.
      const userId = defaultValues?.id; 
      
      if (!userId) {
        console.error("Erro: ID do usuário ausente no modo de edição.");
        return;
      }
      onSubmit({
        id: userId, // Usamos o ID dos defaultValues
        first_name: values.first_name,
        last_name: values.last_name,
        role: values.role,
      });
    } else {
      // Para criação, enviamos todos os campos
      onSubmit(values);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {!isEditing && (
          <>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Primeiro nome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sobrenome (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Sobrenome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Função</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (isEditing ? "Salvar Alterações" : "Criar Usuário")}
        </Button>
      </form>
    </Form>
  );
}