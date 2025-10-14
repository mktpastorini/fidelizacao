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
  "message_template": "Oi {nome}! Sua pizza favorita {pizza_favorita} está deliciosa hoje!",
  "callback_endpoint": "https://.../functions/v1/update-message-status",
  "recipients": [
    {
      "log_id": "c1e986de-...",
      "phone": "82988898565",
      "personalization_data": {
        "nome": "Matheus Pastorini",
        "pizza_favorita": "Camarão"
      }
    },
    {
      "log_id": "d9f91aa4-...",
      "phone": "82988898888",
      "personalization_data": {
        "nome": "tstes",
        "pizza_favorita": "Espaguete"
      }
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
            <li><code className="bg-gray-100 p-1 rounded">message_template</code>: (Apenas em massa) O template da mensagem com as variáveis (ex: `{nome}`).</li>
            <li><code className="bg-gray-100 p-1 rounded">callback_endpoint</code>: A URL que seu sistema deve chamar para nos informar o status da entrega.</li>
            <li><code className="bg-gray-100 p-1 rounded">recipients</code>: (Apenas em massa) Um array com os dados de cada destinatário.</li>
            <li><code className="bg-gray-100 p-1 rounded">log_id</code>: O ID único desta transação.</li>
            <li><code className="bg-gray-100 p-1 rounded">phone</code>: O número de WhatsApp do cliente.</li>
            <li><code className="bg-gray-100 p-1 rounded">personalization_data</code>: (Apenas em massa) Um objeto com as chaves e valores para substituir as variáveis no template.</li>
            <li><code className="bg-gray-100 p-1 rounded">message</code>: (Apenas em evento único) A mensagem final, já personalizada.</li>
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