import { MessageLog } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type LogDetailsModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  log: MessageLog | null;
};

export function LogDetailsModal({ isOpen, onOpenChange, log }: LogDetailsModalProps) {
  if (!log) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Envio</DialogTitle>
          <DialogDescription>
            Enviado em {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <p><strong>Cliente:</strong> {log.cliente?.nome || "N/A"}</p>
            <p><strong>Template:</strong> {log.template?.nome || "N/A"}</p>
            <p><strong>Gatilho:</strong> {log.trigger_event}</p>
            <p><strong>Status:</strong>
              <Badge
                variant={log.status === 'sucesso' ? 'default' : 'destructive'}
                className={cn(log.status === 'sucesso' && "bg-green-500 hover:bg-green-600 text-primary-foreground")}
              >
                {log.status}
              </Badge>
            </p>
          </div>

          {log.status === 'falha' && log.error_message && (
            <div>
              <h4 className="font-semibold mb-1">Mensagem de Erro</h4>
              <pre className="bg-destructive/10 p-3 rounded-md text-sm text-destructive whitespace-pre-wrap break-all">
                {log.error_message}
              </pre>
            </div>
          )}

          {log.webhook_response && (
            <div>
              <h4 className="font-semibold mb-1">Resposta do Webhook</h4>
              <pre className="bg-secondary p-3 rounded-md text-sm whitespace-pre-wrap break-all">
                {JSON.stringify(log.webhook_response, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}