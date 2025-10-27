import { CashierMode } from "@/components/caixa/CashierMode";

export default function CaixaPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-3xl font-bold">Modo Caixa</h1>
        <p className="text-muted-foreground mt-1">
          Use o reconhecimento facial para identificar clientes e agilizar o processo de pagamento.
        </p>
      </div>
      <div className="flex-1 flex justify-center items-start">
        <div className="w-full max-w-2xl">
          <CashierMode />
        </div>
      </div>
    </div>
  );
}