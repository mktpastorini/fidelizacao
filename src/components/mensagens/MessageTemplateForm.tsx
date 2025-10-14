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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageTemplate } from "@/types/supabase";
import { VariableReference } from "./VariableReference";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Smile } from "lucide-react";
import { useRef } from "react";

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome do template é obrigatório." }),
  conteudo: z.string().min(10, { message: "O conteúdo deve ter pelo menos 10 caracteres." }),
  tipo: z.enum(["chegada", "pagamento", "geral"]),
});

type MessageTemplateFormProps = {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<MessageTemplate>;
};

export function MessageTemplateForm({ onSubmit, isSubmitting, defaultValues }: MessageTemplateFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: defaultValues?.nome || "",
      conteudo: defaultValues?.conteudo || "",
      tipo: defaultValues?.tipo || "geral",
    },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);
    
    form.setValue("conteudo", newText, { shouldValidate: true });

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
      textarea.focus();
    }, 0);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    insertTextAtCursor(emojiData.emoji);
  };

  const handleVariableClick = (variable: string) => {
    insertTextAtCursor(variable);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Template</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Mensagem de Boas-Vindas" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de template" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="chegada">Chegada de Cliente</SelectItem>
                    <SelectItem value="pagamento">Pós-Pagamento</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="conteudo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conteúdo da Mensagem</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Textarea
                      placeholder="Escreva sua mensagem aqui..."
                      rows={8}
                      {...field}
                      ref={textareaRef}
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="absolute bottom-2 right-2 h-7 w-7">
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 border-0">
                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar Template"}
          </Button>
        </form>
      </Form>
      <div className="pt-2">
        <VariableReference onVariableClick={handleVariableClick} />
      </div>
    </div>
  );
}