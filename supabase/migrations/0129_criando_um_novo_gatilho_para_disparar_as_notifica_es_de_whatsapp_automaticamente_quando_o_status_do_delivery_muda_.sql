-- Função que será chamada pelo gatilho
CREATE OR REPLACE FUNCTION public.trigger_delivery_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  project_url TEXT := 'https://hgqcmpuihoflkkobtyfa.supabase.co';
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhncWNtcHVpaG9mbGtrb2J0eWZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMyNDk4NCwiZXhwIjoyMDc1OTAwOTg0fQ.u-2o-3Gf02i_b2j2Qp3zpc4Q_2-w_2-w_2-w_2-w_2-w'; -- Substitua pela sua chave de serviço
BEGIN
  -- Verifica se o status foi realmente alterado e se é um dos status que queremos notificar
  IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status AND
     NEW.delivery_status IN ('in_preparation', 'ready_for_delivery') THEN
    
    -- Invoca a Edge Function de forma assíncrona
    PERFORM net.http_post(
      url := project_url || '/functions/v1/send-delivery-status-update',
      body := jsonb_build_object(
        'orderId', NEW.id,
        'newStatus', NEW.delivery_status
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Cria o gatilho na tabela de pedidos
DROP TRIGGER IF EXISTS on_delivery_status_change ON public.pedidos;
CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE OF delivery_status ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_delivery_notification();