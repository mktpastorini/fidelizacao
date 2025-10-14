import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CodeBlock } from "./CodeBlock";
import { Badge } from "@/components/ui/badge";

const arrivalPayload = `{
  "phone": "5511999998888",
  "message": "Olá João! Que bom ver você novamente!",
  "client_name": "João da Silva"
}`;

const paymentPayload = `{
  "phone": "5511999998888",
  "message": "Obrigado pela sua visita, João! Esperamos te ver novamente em breve.",
  "client_name": "João da Silva"
}`;

export function ApiDocumentation() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Introdução</CardTitle>
          <CardDescription>
            Esta documentação detalha como seu sistema pode receber informações do Fidelize através de webhooks.
            Quando eventos específicos ocorrem (como a chegada de um cliente), enviamos uma requisição POST para a URL de webhook que você configurou.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            A URL para os webhooks é a que você define na aba "Perfil & Integrações". Todos os webhooks são enviados como requisições <Badge variant="secondary">POST</Badge> com um corpo em formato JSON.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evento: Chegada de Cliente</CardTitle>
          <CardDescription>
            Disparado quando um cliente é reconhecido e você confirma a chegada. O template de mensagem do tipo "Chegada" é utilizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="font-semibold">Exemplo de Payload:</h4>
          <CodeBlock code={arrivalPayload} />
          <h4 className="font-semibold">Campos do Payload:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li><code className="bg-gray-100 p-1 rounded">phone</code>: O número de WhatsApp do cliente (string).</li>
            <li><code className="bg-gray-100 p-1 rounded">message</code>: A mensagem final, já personalizada com as variáveis do cliente (string).</li>
            <li><code className="bg-gray-100 p-1 rounded">client_name</code>: O nome completo do cliente (string).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evento: Confirmação de Pagamento</CardTitle>
          <CardDescription>
            Disparado quando uma conta de uma mesa é fechada (finalizada e paga). O template de mensagem do tipo "Pós-Pagamento" é utilizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="font-semibold">Exemplo de Payload:</h4>
          <CodeBlock code={paymentPayload} />
           <h4 className="font-semibold">Campos do Payload:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li><code className="bg-gray-100 p-1 rounded">phone</code>: O número de WhatsApp do cliente (string).</li>
            <li><code className="bg-gray-100 p-1 rounded">message</code>: A mensagem final, já personalizada com as variáveis do cliente (string).</li>
            <li><code className="bg-gray-100 p-1 rounded">client_name</code>: O nome completo do cliente (string).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}