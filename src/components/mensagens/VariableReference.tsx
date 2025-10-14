import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

const variables = [
  { name: "{nome}", description: "Nome do cliente." },
  { name: "{conjuge}", description: "Nome do cônjuge." },
  { name: "{indicacoes}", description: "Número de indicações." },
  { name: "{pizza_favorita}", description: "Vem das 'Preferências'." },
  { name: "{bebida_favorita}", description: "Vem das 'Preferências'." },
  { name: "{prato_favorito}", description: "Vem das 'Preferências'." },
  { name: "{observacoes}", description: "Vem das 'Preferências'." },
];

type VariableReferenceProps = {
  onVariableClick: (variable: string) => void;
};

export function VariableReference({ onVariableClick }: VariableReferenceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />
          Variáveis Disponíveis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Clique em uma variável para inserir no texto. Elas serão substituídas pelos dados do cliente.
        </p>
        <div className="flex flex-wrap gap-2">
          {variables.map((variable) => (
            <Badge
              key={variable.name}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
              title={variable.description}
              onClick={() => onVariableClick(variable.name)}
            >
              {variable.name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}