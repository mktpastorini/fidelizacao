import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";

const defaultTemplates = [
  {
    nome: "Boas-vindas Padrão",
    conteudo: "Olá {nome}! Que bom ver você novamente na nossa pizzaria! 🍕",
    tipo: "chegada",
  },
  {
    nome: "Agradecimento Pós-Pagamento",
    conteudo: "Obrigado pela sua visita, {nome}! Esperamos te ver novamente em breve. 😊",
    tipo: "pagamento",
  },
  {
    nome: "Feliz Aniversário!",
    conteudo: "Olá {nome}! Desejamos a você um feliz aniversário, cheio de alegria e pizza! 🍕 Como presente, seu próximo pedido tem 10% de desconto!",
    tipo: "aniversario",
  },
  {
    nome: "Promoção Especial",
    conteudo: "Olá {nome}! Temos uma promoção especial hoje: 20% de desconto na sua pizza {pizza_favorita}!",
    tipo: "geral",
  },
];

type DefaultTemplatesProps = {
  onAdd: (template: Omit<any, 'id' | 'created_at' | 'user_id'>) => void;
  existingTemplateNames: string[];
};

export function DefaultTemplates({ onAdd, existingTemplateNames }: DefaultTemplatesProps) {
  const availableTemplates = defaultTemplates.filter(t => !existingTemplateNames.includes(t.nome));

  if (availableTemplates.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold mb-3">Templates Sugeridos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableTemplates.map((template) => (
          <Card key={template.nome}>
            <CardHeader>
              <CardTitle>{template.nome}</CardTitle>
              <CardDescription>Tipo: {template.tipo}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm bg-secondary p-3 rounded-md border italic">"{template.conteudo}"</p>
              <Button size="sm" className="mt-4" onClick={() => onAdd(template)}>
                <MessageSquarePlus className="w-4 h-4 mr-2" />
                Adicionar este template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}