import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function personalizeMessage(content: string, client: any): string {
  let personalized = content;
  const clientData = {
    nome: client.nome || '',
    conjuge: client.casado_com || '',
    indicacoes: client.indicacoes?.toString() || '0',
  };

  for (const [key, value] of Object.entries(clientData)) {
    personalized = personalized.replace(new RegExp(`{${key}}`, 'g'), value);
  }

  if (client.gostos && typeof client.gostos === 'object') {
    for (const [key, value] of Object.entries(client.gostos)) {
      personalized = personalized.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
  }

  personalized = personalized.replace(/{[a-zA-Z_]+}/g, '');
  return personalized;
}

serve(async (_req) => {
  // Esta função é executada automaticamente pelo agendador, não precisa de autenticação
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("=== INICIANDO ENVIO AUTOMÁTICO DE MENSAGENS DE ANIVERSÁRIO ===");
    
    // Buscar todos os usuários que têm o template de aniversário configurado
    const { data: usersWithSettings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('id, webhook_url, aniversario_template_id, aniversario_horario')
      .not('aniversario_template_id', 'is', null)
      .not('webhook_url', 'is', null);
    
    if (settingsError) {
      console.error("Erro ao buscar configurações dos usuários:", settingsError);
      throw settingsError;
    }
    
    console.log(`Encontrados ${usersWithSettings?.length || 0} usuários com configurações de aniversário`);
    
    if (!usersWithSettings || usersWithSettings.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum usuário com configurações de aniversário encontradas." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Processar cada usuário
    for (const userSettings of usersWithSettings) {
      try {
        console.log(`Processando usuário: ${userSettings.id}`);
        
        // Verificar se é hora de enviar (comparar apenas hora:minuto)
        const now = new Date();
        const currentTime = now.toTimeString().substring(0, 5); // HH:MM
        const scheduledTime = userSettings.aniversario_horario || "09:00";
        
        console.log(`Hora atual: ${currentTime}, Hora agendada: ${scheduledTime}`);
        
        // Se não for a hora certa, pular este usuário
        if (currentTime !== scheduledTime) {
          console.log(`Ainda não é hora de enviar para o usuário ${userSettings.id}`);
          continue;
        }
        
        // Buscar o template
        const { data: template, error: templateError } = await supabaseAdmin
          .from('message_templates')
          .select('conteudo')
          .eq('id', userSettings.aniversario_template_id)
          .single();
          
        if (templateError || !template) {
          console.error(`Erro ao buscar template para usuário ${userSettings.id}:`, templateError);
          continue;
        }
        
        // Buscar aniversariantes do dia para este usuário específico
        const { data: birthdayClients, error: clientsError } = await supabaseAdmin.rpc('get_todays_birthdays_by_user', { p_user_id: userSettings.id });
        if (clientsError) {
          console.error(`Erro ao buscar aniversariantes para usuário ${userSettings.id}:`, clientsError);
          continue;
        }
        
        console.log(`Aniversariantes encontrados para usuário ${userSettings.id}:`, birthdayClients?.length || 0);
        
        if (!birthdayClients || birthdayClients.length === 0) {
          console.log(`Nenhum aniversariante hoje para o usuário ${userSettings.id}`);
          continue;
        }
        
        // Criar logs para cada mensagem
        const logsToInsert = birthdayClients.map(client => ({
          user_id: userSettings.id,
          cliente_id: client.id,
          template_id: userSettings.aniversario_template_id,
          trigger_event: 'aniversario',
          status: 'processando',
        }));
        
        const { data: insertedLogs, error: logError } = await supabaseAdmin
          .from('message_logs')
          .insert(logsToInsert)
          .select('id, cliente_id');
          
        if (logError || !insertedLogs) {
          console.error(`Erro ao criar logs para usuário ${userSettings.id}:`, logError);
          continue;
        }
        
        // Preparar os destinatários
        const recipients = birthdayClients.map(client => {
          const log = insertedLogs.find(l => l.cliente_id === client.id);
          return {
            log_id: log?.id,
            phone: client.whatsapp,
            message: personalizeMessage(template.conteudo, client),
            client_name: client.nome,
            callback_endpoint: `${Deno.env.get('SUPABASE_URL')}/functions/v1/update-message-status`,
          };
        });
        
        console.log(`Enviando ${recipients.length} mensagens para o usuário ${userSettings.id}`);
        
        // Enviar para o webhook
        const webhookResponse = await fetch(userSettings.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients }),
        });
        
        const responseBody = await webhookResponse.json().catch(() => webhookResponse.text());
        const logIdsToUpdate = insertedLogs.map(l => l.id);
        
        if (!webhookResponse.ok) {
          await supabaseAdmin.from('message_logs').update({ 
            status: 'falha', 
            error_message: `Webhook falhou: ${webhookResponse.status}`, 
            webhook_response: responseBody 
          }).in('id', logIdsToUpdate);
          
          console.error(`Webhook falhou para usuário ${userSettings.id} com status: ${webhookResponse.status}`);
        } else {
          await supabaseAdmin.from('message_logs').update({ 
            status: 'sucesso', 
            webhook_response: responseBody 
          }).in('id', logIdsToUpdate);
          
          console.log(`Mensagens enviadas com sucesso para usuário ${userSettings.id}`);
        }
      } catch (userError) {
        console.error(`Erro ao processar usuário ${userSettings.id}:`, userError);
      }
    }
    
    return new Response(JSON.stringify({ success: true, message: "Processo de envio automático concluído." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Erro no envio automático de mensagens de aniversário:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});