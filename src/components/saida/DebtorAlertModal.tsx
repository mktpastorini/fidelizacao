import { useEffect } from 'react';
import { Cliente } from '@/types/supabase';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speak } from '@/utils/tts';
import { useSettings } from '@/contexts/SettingsContext';

type DebtorAlertModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
};

export function DebtorAlertModal({ isOpen, onOpenChange, cliente }: DebtorAlertModalProps) {
  const { settings } = useSettings();

  useEffect(() => {
    if (isOpen && cliente) {
      const defaultPhrase = "{nome}, por favor, dirija-se ao caixa para efetuar o pagamento.";
      const phrase = settings?.exit_alert_phrase || defaultPhrase;
      const personalizedPhrase = phrase.replace(/{nome}/g, cliente.nome);
      
      const speakAndRepeat = () => {
        // Só fala se não estiver falando no momento, para evitar sobreposição
        if (!window.speechSynthesis.speaking) {
          speak(personalizedPhrase);
        }
      };

      speakAndRepeat(); // Fala imediatamente ao abrir o modal
      const intervalId = setInterval(speakAndRepeat, 4000); // Repete a cada 4 segundos

      // Limpa o intervalo e para a fala quando o modal é fechado
      return () => {
        clearInterval(intervalId);
        window.speechSynthesis.cancel();
      };
    }
  }, [isOpen, cliente, settings]);

  if (!cliente) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-destructive text-destructive-foreground border-4 border-yellow-400 p-0">
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <AlertTriangle className="w-24 h-24 text-yellow-400 mb-4" />
          <h1 className="text-4xl font-extrabold uppercase tracking-wider">Alerta de Saída</h1>
          <p className="text-lg mt-2">O cliente abaixo está tentando sair sem pagar!</p>
          
          <div className="my-8 flex flex-col items-center gap-4">
            <Avatar className="w-48 h-48 ring-4 ring-yellow-400 ring-offset-4 ring-offset-destructive">
              <AvatarImage src={cliente.avatar_url || undefined} />
              <AvatarFallback>
                <User className="w-24 h-24" />
              </AvatarFallback>
            </Avatar>
            <p className="text-5xl font-bold">{cliente.nome}</p>
          </div>

          <Button 
            onClick={() => onOpenChange(false)} 
            className="bg-yellow-400 text-destructive-foreground hover:bg-yellow-500 text-lg px-8 py-6"
          >
            Fechar Alerta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}