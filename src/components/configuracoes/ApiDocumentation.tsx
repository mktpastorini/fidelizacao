import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CodeBlock } from "./CodeBlock";
import { Badge } from "@/components/ui/badge";

const unifiedPayload = `{
  "recipients": [
    {
      "log_id": "c1e986de-...",
      "phone": "82988898565",
      "message": "Oi Matheus Pastorini! Sua pizza favorita Camarão está deliciosa hoje! Quer experimentar?",
      "client_name": "Matheus Pastorini",
      "callback_endpoint": "https://.../functions/v1/update-message-status"
    }
  ]
}`;

const updateStatusPayload = `{
  "log_id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "status": "delivered"
}`;

const birthdayTriggerPayload = `{
  // Corpo vazio - apenas autenticação via header
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
            Quando um evento ocorre, enviamos uma requisição <Badge variant="secondary">POST</Badge> para a sua URL de webhook configurada com o payload abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="font-semibold">Exemplo de Payload:</h4>
          <CodeBlock code={unifiedPayload} />
          <h4 className="font-semibold mt-4">Campos do Payload:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li><code className="bg-gray-100 p-1 rounded">recipients</code>: Um array de objetos, um para cada destinatário. Para eventos únicos (chegada, pagamento), este array conterá apenas um elemento.</li>
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

      <Card>
        <CardHeader>
          <CardTitle>API: Envio de Mensagens de Aniversário</CardTitle>
          <CardDescription>
            Endpoint para acionar o envio automático de mensagens de aniversário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <Badge variant="secondary">POST</Badge> `https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/trigger-birthday-wishes`
          </div>
          <h4 className="font-semibold">Cabeçalhos (Headers):</h4>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>`Authorization`: `Bearer SUA_CHAVE_DE_API`</li>
            <li>`Content-Type`: `application/json`</li>
          </ul>
          <h4 className="font-semibold">Corpo (Body):</h4>
          <CodeBlock code={birthdayTriggerPayload} />
          <div className="text-sm text-muted-foreground">
            <p>Este endpoint não requer um corpo específico. Apenas a autenticação via header é necessária.</p>
            <p className="mt-2">Quando chamado, o sistema:</p>
            <ul className="list-disc list-inside mt-1">
              <li>Verifica os clientes que fazem aniversário hoje</li>
              <li>Usa o template de aniversário configurado nas "Automações"</li>
              <li>Envia as mensagens personalizadas através do webhook configurado</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}