import { Cliente } from "@/types/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Heart, Users, ThumbsUp, Trash2, Edit, Eye } from "lucide-react";
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ClienteCardProps = {
  cliente: Cliente;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const InfoBadge = ({ icon: Icon, text, className }: { icon: React.ElementType, text: string | number, className?: string }) => (
  <div className={`flex items-center text-sm ${className}`}>
    <Icon className="w-4 h-4 mr-2" />
    <span>{text}</span>
  </div>
);

const PreferenceItem = ({ label, value, className }: { label: string, value: string, className?: string }) => (
  <div className={`p-2 rounded-md text-sm ${className}`}>
    <span className="font-semibold">{label}:</span> {value}
  </div>
);

export function ClienteCard({ cliente, onView, onEdit, onDelete }: ClienteCardProps) {
  const tempoCliente = formatDistanceToNowStrict(new Date(cliente.cliente_desde), { locale: ptBR, addSuffix: true });

  const renderGostos = () => {
    if (!cliente.gostos || typeof cliente.gostos !== 'object') return null;
    
    const pizzaFavorita = cliente.gostos.pizza_favorita;
    const outrosGostos = Object.entries(cliente.gostos)
      .filter(([key]) => key !== 'pizza_favorita')
      .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
      .join(', ');

    return (
      <>
        {pizzaFavorita && (
          <PreferenceItem label="Pizza Favorita" value={pizzaFavorita} className="bg-yellow-100 text-yellow-800" />
        )}
        {outrosGostos && (
          <PreferenceItem label="Gostos" value={outrosGostos} className="bg-green-100 text-green-800" />
        )}
      </>
    );
  };

  return (
    <Card className="flex flex-col justify-between shadow-lg border-t-4 border-blue-500">
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{cliente.nome}</h3>
          <p className="text-xs text-gray-500">Cliente {tempoCliente}</p>
        </div>
        
        <div className="space-y-2 text-gray-600">
          {cliente.whatsapp && <InfoBadge icon={Phone} text={cliente.whatsapp} />}
          {cliente.casado_com && <InfoBadge icon={Heart} text={`Casado(a) com ${cliente.casado_com}`} />}
          {cliente.filhos && cliente.filhos.length > 0 && <InfoBadge icon={Users} text={`${cliente.filhos.length} filho(s)`} />}
        </div>

        <div className="space-y-2 pt-2">
          {renderGostos()}
          <PreferenceItem label="Indicações" value={`${cliente.indicacoes} cliente(s)`} className="bg-blue-100 text-blue-800" />
        </div>
      </CardContent>
      
      <div className="flex items-center justify-end p-2 bg-gray-50 border-t">
        <Button variant="ghost" size="icon" onClick={onView}><Eye className="w-4 h-4 text-gray-600" /></Button>
        <Button variant="ghost" size="icon" onClick={onEdit}><Edit className="w-4 h-4 text-blue-600" /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="w-4 h-4 text-red-600" /></Button>
      </div>
    </Card>
  );
}