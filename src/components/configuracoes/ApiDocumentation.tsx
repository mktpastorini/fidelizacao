import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CodeBlock } from "./CodeBlock";
import { Badge } from "@/components/ui/badge";

const arrivalPayload = `{
  "log_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "phone": "5511999998888",
  "message": "Olá João! Que bom ver você novamente!",
  "client_name": "João da Silva",
  "callback_endpoint": "https://.../functions/v1/update-message-status"
}`;

const bulkPayload = `{
  "recipients": [
    {
      "log_id": "c1e986de-...",
      "phone": "82988898565",
      "message": "Oi Matheus Pastorini! Sua pizza favorita Camarão está deliciosa hoje! Quer experimentar?",
      "client_name": "Matheus Pastorini",
      "callback_endpoint": "https://.../functions/v1/update-message-status"
    },
    {
      "log_id": "d9f91aa4-...",
      "phone": "82988898888",
      "message": "Oi tstes! Sua pizza favorita Espaguete está deliciosa hoje! Quer experimentar?",
      "client_name": "tstes",
      "callback_endpoint": "https://.../functions/v1/update-message-status"
    }
  ]
}`;

const updateStatusPayload = `{
  "log_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "status": "delivered"
}`;

export function ApiDocumentation() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Introdução</CardTitle>
          <CardDescription>
            Esta documentação detalha como seu sistema pode interagir com a API do Fidelize.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            As interações são feitas via webhooks (Fidelize → Seu Sistema) e endpoints de API (Seu Sistema → Fidelize).
            A autenticação para a API do Fidelize é feita via Bearer Token no cabeçalho `Authorization`, usando a Chave de API da aba "Perfil & Integrações".
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook: Eventos do Fidelize</CardTitle>
          <CardDescription>
            Quando eventos ocorrem, enviamos uma requisição <Badge variant="secondary">POST</Badge> para a sua URL de webhook configurada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="font-semibold">Payload de Evento Único (Chegada, Pagamento):</h4>
          <CodeBlock code={arrivalPayload} />
          <h4 className="font-semibold mt-4">Payload de Envio em Massa (Manual):</h4>
          <CodeBlock code={bulkPayload} />
          <h4 className="font-semibold mt-4">Campos do Payload:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Para eventos únicos, o corpo da requisição é um objeto único.</li>
            <li>Para envios em massa, o corpo contém uma chave `recipients` com um array de objetos, cada um com sua mensagem personalizada.</li>
            <li><code className="bg-gray-100 p-1 rounded">log_id</code>: O ID único desta transação. **Guarde este ID** para nos informar o status da entrega (string, UUID).</li>
            <li><code className="bg-gray-100 p-1 rounded">phone</code>: O número de WhatsApp do cliente (string).</li>
            <li><code className="bg-gray-100 p-1 rounded">message</code>: A mensagem final, já personalizada (string).</li>
            <li><code className="bg-gray-100 p-1 rounded">client_name</code>: O nome completo do cliente (string).</li>
            <li><code className="bg-gray-100 p-1 rounded">callback_endpoint</code>: A URL de callback que seu sistema deve chamar para nos informar o status da entrega (string, URL).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API: Atualizar Status de Entrega</CardTitle>
          <CardDescription>
            Após seu sistema tentar enviar a mensagem, ele **deve** chamar este endpoint para nos informar o resultado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <Badge variant="secondary">POST</Badge> `https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/update-message-status`
          </div>
          <h4 className="font-semibold">Cabeçalhos (Headers):</h4>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>`Authorization`: `Bearer SUA_CHAVE_DE_API`</li>
            <li>`Content-Type`: `application/json`</li>
          </ul>
          <h4 className="font-semibold">Exemplo de Corpo (Body):</h4>
          <CodeBlock code={updateStatusPayload} />
          <h4 className="font-semibold">Campos do Corpo:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li><code className="bg-gray-100 p-1 rounded">log_id</code>: O ID que você recebeu no webhook (string, UUID).</li>
            <li><code className="bg-gray-100 p-1 rounded">status</code>: O status final da entrega. Valores possíveis: `"delivered"` ou `"failed"` (string).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}