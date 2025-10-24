import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

export function IFoodSettings() {
  const testIntegrationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-ifood-integration');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        showSuccess(data.message);
      } else {
        showError(data.error || "O teste falhou por um motivo desconhecido.");
      }
    },
    onError: (error: Error) => {
      showError(`Teste falhou: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Configuração Manual Necessária</AlertTitle>
        <AlertDescription>
          <p>Para que a integração com o iFood funcione, você precisa adicionar suas credenciais como "Secrets" no painel do Supabase.</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Acesse seu projeto no <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="underline">Supabase</a>.</li>
            <li>Vá para <strong>Edge Functions</strong> &gt; <strong>Manage Secrets</strong>.</li>
            <li>Adicione os três segredos a seguir com os valores do seu portal de desenvolvedor iFood:
              <ul className="list-disc list-inside ml-4 mt-1">
                <li><code className="font-mono bg-muted p-1 rounded">IFOOD_CLIENT_ID</code></li>
                <li><code className="font-mono bg-muted p-1 rounded">IFOOD_CLIENT_SECRET</code></li>
                <li><code className="font-mono bg-muted p-1 rounded">IFOOD_WEBHOOK_SECRET</code> (Chave de Assinatura do Webhook)</li>
              </ul>
            </li>
          </ol>
        </AlertDescription>
      </Alert>
      <Button onClick={() => testIntegrationMutation.mutate()} disabled={testIntegrationMutation.isPending}>
        {testIntegrationMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        {testIntegrationMutation.isPending ? "Testando..." : "Testar Integração com iFood"}
      </Button>
    </div>
  );
}