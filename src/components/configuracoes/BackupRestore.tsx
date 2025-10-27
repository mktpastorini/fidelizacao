import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('export-data');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fidelize_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess("Exportação concluída!");
    },
    onError: (error: Error) => showError(`Falha na exportação: ${error.message}`),
  });

  const importMutation = useMutation({
    mutationFn: async (backupData: any) => {
      const { data, error } = await supabase.functions.invoke('import-data', { body: backupData });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      showSuccess(data.message);
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (error: Error) => showError(`Falha na importação: ${error.message}`),
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (typeof content !== 'string') throw new Error("Conteúdo do arquivo inválido.");
        const jsonData = JSON.parse(content);
        importMutation.mutate(jsonData);
      } catch (err: any) {
        showError(`Erro ao ler o arquivo de backup: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Exportar Dados</CardTitle>
          <CardDescription>
            Crie um backup de todos os seus dados (clientes, produtos, pedidos, etc.) em um arquivo JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exportMutation.isPending ? "Exportando..." : "Baixar Arquivo de Backup"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Importar Dados</CardTitle>
          <CardDescription>
            Restaure o sistema a partir de um arquivo de backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ação Destrutiva</AlertTitle>
            <AlertDescription>
              A importação de um backup irá **apagar permanentemente todos os dados atuais** do sistema. Use com cuidado.
            </AlertDescription>
          </Alert>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={importMutation.isPending}>
                {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importMutation.isPending ? "Importando..." : "Carregar Arquivo de Backup"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação substituirá todos os dados existentes. Não é possível desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => fileInputRef.current?.click()}>
                  Continuar e Selecionar Arquivo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardContent>
      </Card>
    </div>
  );
}