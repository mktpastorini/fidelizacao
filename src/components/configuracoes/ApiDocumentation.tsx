import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CodeBlock } from "./CodeBlock";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/contexts/SettingsContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const triggerPayload = `{
  // Corpo vazio - apenas autenticação via header
}`;

export function ApiDocumentation() {
  const { settings } = useSettings();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUserId();
  }, []);

  const ifoodWebhookUrl = `https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/ifood-webhook-handler?user_id=${userId || 'SEU_USER_ID'}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Introdução à API</CardTitle>
          <CardDescription>
            Esta documentação detalha como seu sistema pode interagir com a API do Fidelize para automações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="font-semibold">Autenticação</h4>
          <p className="text-sm">
            Todas as requisições para a API do Fidelize devem ser autenticadas usando sua Chave de API.
            A chave deve ser enviada no cabeçalho `Authorization` como um Bearer Token.
          </p>
          <CodeBlock code={`Authorization: Bearer ${settings?.api_key || 'SUA_CHAVE_DE_API'}`} />
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold pt-4">Webhooks (Fidelize → Seu Sistema)</h2>

      <Card>
        <CardHeader>
          <CardTitle>Recebimento de Eventos</CardTitle>
          <CardDescription>
            Quando um evento ocorre (chegada de cliente, pagamento, etc.), enviamos uma requisição <Badge variant="secondary">POST</Badge> para a sua URL de webhook configurada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="font-semibold">Exemplo de Payload:</h4>
          <CodeBlock code={unifiedPayload} />
          <h4 className="font-semibold mt-4">Campos do Payload:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-foreground">
            <li><code className="bg-muted p-1 rounded text-foreground">recipients</code>: Um array de objetos, um para cada destinatário.</li>
            <li><code className="bg-muted p-1 rounded text-foreground">log_id</code>: O ID único desta transação. **Guarde este ID** para nos informar o status da entrega.</li>
            <li><code className="bg-muted p-1 rounded text-foreground">phone</code>: O número de WhatsApp do cliente.</li>
            <li><code className="bg-muted p-1 rounded text-foreground">message</code>: A mensagem final, já personalizada.</li>
            <li><code className="bg-muted p-1 rounded text-foreground">client_name</code>: O nome completo do cliente.</li>
            <li><code className="bg-muted p-1 rounded text-foreground">callback_endpoint</code>: A URL que seu sistema deve chamar para nos informar o status da entrega.</li>
          </ul>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold pt-4">API Endpoints (Seu Sistema → Fidelize)</h2>

      <Card>
        <CardHeader>
          <CardTitle>Listar Produtos</CardTitle>
          <CardDescription>
            Retorna uma lista de todos os produtos cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Endpoint:</div>
          <CodeBlock code="GET https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/list-products" />
          <h4 className="font-semibold">Exemplo de Resposta de Sucesso:</h4>
          <CodeBlock code={`{
  "success": true,
  "products": [
    {
      "id": "uuid-do-produto-1",
      "nome": "Pizza de Calabresa",
      "preco": 45.50,
      "descricao": "Molho de tomate, calabresa e cebola.",
      "tipo": "venda",
      "requer_preparo": true,
      "estoque_atual": 50,
      "mostrar_no_menu": true
    },
    { ... }
  ]
}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Criar Pedido de Delivery</CardTitle>
          <CardDescription>
            Cria um novo pedido de delivery para um cliente existente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Endpoint:</div>
          <CodeBlock code="POST https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/create-delivery-order" />
          <h4 className="font-semibold">Exemplo de Corpo (Body):</h4>
          <CodeBlock code={`{
  "cliente_id": "uuid-do-cliente-existente",
  "channel": "whatsapp",
  "items": [
    { "produto_id": "uuid-do-produto-1", "quantidade": 2 },
    { "produto_id": "uuid-do-produto-2", "quantidade": 1 }
  ],
  "delivery_address": {
    "streetName": "Rua Nova",
    "streetNumber": "456",
    "neighborhood": "Bairro Novo",
    "city": "Cidade Nova",
    "postalCode": "12345-678",
    "complement": "Casa"
  }
}`} />
          <h4 className="font-semibold">Notas:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-foreground">
            <li>O campo <code className="bg-muted p-1 rounded">delivery_address</code> é opcional. Se não for fornecido, o endereço salvo no cadastro do cliente será utilizado.</li>
          </ul>
          <h4 className="font-semibold">Exemplo de Resposta de Sucesso:</h4>
          <CodeBlock code={`{
  "success": true,
  "message": "Pedido de delivery criado com sucesso.",
  "order_id": "uuid-do-novo-pedido"
}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Atualizar Status de Entrega</CardTitle>
          <CardDescription>
            Após seu sistema tentar enviar a mensagem, ele **deve** chamar este endpoint para nos informar o resultado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Endpoint:</div>
          <CodeBlock code="POST https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/update-message-status" />
          <h4 className="font-semibold">Exemplo de Corpo (Body):</h4>
          <CodeBlock code={updateStatusPayload} />
          <h4 className="font-semibold">Campos do Corpo:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-foreground">
            <li><code className="bg-muted p-1 rounded text-foreground">log_id</code>: O ID que você recebeu no webhook.</li>
            <li><code className="bg-muted p-1 rounded text-foreground">status</code>: Valores possíveis: <code className="bg-muted p-1 rounded text-foreground">"delivered"</code> ou <code className="bg-muted p-1 rounded text-foreground">"failed"</code>.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acionar Envio de Mensagens de Aniversário</CardTitle>
          <CardDescription>
            Chame este endpoint para que o sistema verifique os aniversariantes do dia e envie as mensagens configuradas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Endpoint:</div>
          <CodeBlock code="POST https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/trigger-birthday-wishes" />
          <h4 className="font-semibold">Corpo (Body):</h4>
          <CodeBlock code={triggerPayload} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Obter Horário de Envio de Aniversários</CardTitle>
          <CardDescription>
            Consulte o horário configurado para o envio automático de mensagens de aniversário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Endpoint:</div>
          <CodeBlock code="GET https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/get-birthday-schedule" />
          <h4 className="font-semibold">Exemplo de Resposta:</h4>
          <CodeBlock code={`{\n  "success": true,\n  "aniversario_horario": "09:00"\n}`} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Acionar Fechamento Automático do Dia</CardTitle>
          <CardDescription>
            Chame este endpoint para acionar o fechamento do dia e o envio do relatório diário no horário programado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Endpoint:</div>
          <CodeBlock code="POST https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/trigger-close-day" />
          <h4 className="font-semibold">Corpo (Body):</h4>
          <CodeBlock code={triggerPayload} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Obter Horário de Fechamento</CardTitle>
          <CardDescription>
            Consulte o horário configurado para o fechamento automático do dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Endpoint:</div>
          <CodeBlock code="GET https://hgqcmpuihoflkkobtyfa.supabase.co/functions/v1/get-close-day-schedule" />
          <h4 className="font-semibold">Exemplo de Resposta:</h4>
          <CodeBlock code={`{\n  "success": true,\n  "auto_close_time": "23:00"\n}`} />
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold pt-4">Integrações de Terceiros</h2>

      <Card>
        <CardHeader>
          <CardTitle>Webhook: Integração com iFood</CardTitle>
          <CardDescription>
            Para receber pedidos do iFood, configure a seguinte URL no seu painel de desenvolvedor do iFood.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm font-semibold">Sua URL de Webhook iFood:</div>
          <CodeBlock code={ifoodWebhookUrl} />
          <h4 className="font-semibold">Instruções:</h4>
          <ul className="list-disc list-inside space-y-2 text-sm text-foreground">
            <li>Copie a URL acima. Ela já contém seu ID de usuário.</li>
            <li>Cole a URL completa no campo de webhook no seu painel do iFood.</li>
            <li>Certifique-se de que as credenciais do iFood estão salvas como "Secrets" no Supabase (veja a aba "iFood").</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}