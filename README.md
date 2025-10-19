# Welcome to your Dyad app

## Configuração de Envio Automático de Mensagens de Aniversário

Para que o sistema envie automaticamente mensagens de aniversário, você tem duas opções:

### Opção 1: Usando o endpoint de trigger (Recomendado)

Você pode configurar uma automação externa para chamar o endpoint:

`POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/trigger-birthday-wishes`

Com os seguintes headers:
```
Authorization: Bearer SUA_CHAVE_DE_API
Content-Type: application/json
```

E um corpo vazio `{}`.

Este endpoint verificará os aniversariantes do dia e enviará as mensagens através do webhook configurado.

### Opção 2: Usando agendador com função edge

Para que o sistema envie automaticamente mensagens de aniversário no horário configurado, é necessário configurar um agendador (cron job) que execute a função edge `send-daily-birthday-wishes` a cada minuto.

#### Usando Supabase CRON (Recomendado para produção)

Se você estiver usando o Supabase em produção, siga estas etapas:

1. Acesse o painel do Supabase
2. Vá para "Database" > "Extensions"
3. Certifique-se de que a extensão `pg_cron` está instalada
4. Execute o seguinte SQL para criar o agendador:

```sql
-- Criar o job para executar a função a cada minuto
SELECT cron.schedule(
  'send-daily-birthday-wishes', -- nome do job
  '* * * * *', -- a cada minuto
  $$SELECT net.http_post('https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-daily-birthday-wishes', '{}', '{"Content-Type": "application/json"}', null, 5000)$$
);
```

Substitua `YOUR_PROJECT_ID` pelo ID do seu projeto Supabase.

#### Usando um serviço de agendamento externo

Se você não puder usar o Supabase CRON, pode usar um serviço externo como:

1. [Cron-job.org](https://cron-job.org/)
2. [EasyCron](https://www.easycron.com/)
3. AWS CloudWatch Events
4. Google Cloud Scheduler

Configure o serviço para fazer uma requisição HTTP POST para:
`https://YOUR_PROJECT_ID.supabase.co/functions/v1/send-daily-birthday-wishes`

Com o seguinte payload:
```json
{}
```

E os seguintes headers:
```
Content-Type: application/json
```

#### Para desenvolvimento local

Se você estiver desenvolvendo localmente, pode usar o `cron` no Linux/macOS:

1. Abra o terminal
2. Execute `crontab -e`
3. Adicione a seguinte linha:
```
* * * * * curl -X POST -H "Content-Type: application/json" -d '{}' http://localhost:54321/functions/v1/send-daily-birthday-wishes
```

Para Windows, use o Task Scheduler:

1. Abra o Task Scheduler
2. Crie uma nova tarefa
3. Configure um gatilho para executar a cada minuto
4. Configure uma ação para executar o comando:
```
curl -X POST -H "Content-Type: application/json" -d "{}" http://localhost:54321/functions/v1/send-daily-birthday-wishes
```

## Como consultar o horário de envio de aniversários

Para consultar o horário configurado para envio de mensagens de aniversário, utilize a API:

`GET https://YOUR_PROJECT_ID.supabase.co/functions/v1/get-birthday-schedule`

Com os seguintes headers:
```
Authorization: Bearer SUA_CHAVE_DE_API
Content-Type: application/json
```

A resposta será um JSON no formato:
```json
{
  "success": true,
  "aniversario_horario": "09:00"
}
```

## Como funciona

A função `send-daily-birthday-wishes` verifica a cada minuto:

1. Quais usuários têm o envio automático de aniversários configurado
2. Se é o horário correto para enviar as mensagens (comparando apenas hora:minuto)
3. Quais clientes fazem aniversário hoje
4. Envia as mensagens através do webhook configurado

O sistema só enviará as mensagens no horário exato configurado nas configurações do usuário.