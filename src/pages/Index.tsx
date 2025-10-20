"use client";

import { useState } from "react";
import ClientesPage from "./clientes";
import { FacialRecognitionDialog } from "@/components/dashboard/FacialRecognitionDialog";
import { Dialog } from "@/components/ui/dialog";

export default function Index() {
  const [isFacialRecognitionOpen, setIsFacialRecognitionOpen] = useState(false);
  const [isCadastroOpen, setIsCadastroOpen] = useState(false);

  const handleOpenCadastro = () => {
    setIsCadastroOpen(true);
  };

  const handleCloseCadastro = () => {
    setIsCadastroOpen(false);
  };

  return (
    <>
      <button
        className="fixed bottom-6 right-6 bg-primary text-white rounded-full p-4 shadow-lg hover:bg-primary-dark transition"
        onClick={() => setIsFacialRecognitionOpen(true)}
      >
        Abrir Reconhecimento Facial
      </button>

      <FacialRecognitionDialog
        isOpen={isFacialRecognitionOpen}
        onOpenChange={setIsFacialRecognitionOpen}
        onClientRecognized={(cliente) => {
          alert(`Cliente reconhecido: ${cliente.nome}`);
          setIsFacialRecognitionOpen(false);
        }}
        onNewClientRequested={() => {
          setIsFacialRecognitionOpen(false);
          setIsCadastroOpen(true);
        }}
      />

      <ClientesPage />

      {/* Modal de cadastro controlado via estado */}
      <Dialog open={isCadastroOpen} onOpenChange={handleCloseCadastro}>
        {/* O conteúdo do modal de cadastro já está dentro do ClientesPage, 
            mas se preferir, pode extrair o modal para cá para controle centralizado */}
      </Dialog>
    </>
  );
}