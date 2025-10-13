import { Cliente } from "@/types/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Phone, Heart, Users, ThumbsUp, Star, Calendar } from "lucide-react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ClienteDetalhesModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cliente: Cliente | null;
};

const DetailSection = ({ title, icon: Icon, children }: { title: string, icon: React.ElementType, children: React.ReactNode }) => (
  <div>
    <h4 className="flex items-center font-semibold text-gray-700 mb-2">
      <Icon className="w-5 h-5 mr-2 text-blue-500" />
      {title}
    </h4>
    <div className="pl-7 text-gray-600 space-y-1">{children}</div>
  </div>
);

export function ClienteDetalhesModal({ isOpen, onOpenChange, cliente }: ClienteDetalhesModalProps) {
  if (!cliente) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{cliente.nome}</DialogTitle>
          <DialogDescription>
            Cliente desde {format(new Date(cliente.cliente_desde), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <DetailSection title="Contato" icon={Phone}>
            <p>WhatsApp: {cliente.whatsapp || "Não informado"}</p>
          </DetailSection>

          <DetailSection title="Família" icon={Heart}>
            <p>Cônjuge: {cliente.casado_com || "Não informado"}</p>
            {cliente.filhos && cliente.filhos.length > 0 && (
              <div>
                <p className="font-medium">Filhos:</p>
                <ul className="list-disc list-inside">
                  {cliente.filhos.map(filho => (
                    <li key={filho.id}>{filho.nome} ({filho.idade || '?'} anos)</li>
                  ))}
                </ul>
              </div>
            )}
          </DetailSection>

          <DetailSection title="Preferências" icon={Star}>
            {cliente.gostos && typeof cliente.gostos === 'object' ? (
              Object.entries(cliente.gostos).map(([key, value]) => (
                <p key={key}><span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span> {String(value)}</p>
              ))
            ) : <p>Nenhuma preferência cadastrada.</p>}
          </DetailSection>

          <DetailSection title="Fidelidade" icon={ThumbsUp}>
            <p>Indicou {cliente.indicacoes} cliente(s).</p>
          </DetailSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}