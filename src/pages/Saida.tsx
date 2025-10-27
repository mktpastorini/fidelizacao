import { useState } from "react";
import { Cliente } from "@/types/supabase";
import { ExitCamera } from "@/components/saida/ExitCamera";
import { DebtorAlertModal } from "@/components/saida/DebtorAlertModal";

export default function SaidaPage() {
  const [debtor, setDebtor] = useState<Cliente | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const handleDebtorDetected = (cliente: Cliente) => {
    // Só dispara o alerta se ele não estiver aberto,
    // para evitar que o modal fique "piscando" ou seja impossível de fechar.
    if (!isAlertOpen) {
      setDebtor(cliente);
      setIsAlertOpen(true);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold">Monitoramento de Saída</h1>
        <p className="text-muted-foreground mt-1">
          O sistema está monitorando a saída para detectar clientes com contas abertas.
        </p>
      </div>
      <div className="flex-1 flex justify-center items-start">
        <ExitCamera onDebtorDetected={handleDebtorDetected} />
      </div>
      <DebtorAlertModal
        isOpen={isAlertOpen}
        onOpenChange={setIsAlertOpen}
        cliente={debtor}
      />
    </div>
  );
}