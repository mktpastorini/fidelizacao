import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Produto, Mesa } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Utensils, Lock, ReceiptText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicMenuProductCard } from "@/components/menu-publico/PublicMenuProductCard";
import { PublicOrderSummary } from "@/components/menu-publico/PublicOrderSummary"; // Importando o novo componente

type MesaData = Mesa & { user_id: string };

async function fetchProdutosVisiveis(): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("mostrar_no_menu", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchMesaData(mesaId: string): Promise<MesaData | null> {
  const { data, error } = await supabase
    .from("mesas")
    .select("id, numero, cliente_id, user_id")
    .eq("id", mesaId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data as MesaData | null;
}

export default function MenuPublicoPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [mesaData, setMesaData] = useState<MesaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false); // Novo estado para o resumo
  const navigate = useNavigate();
  const { mesaId } = useParams<{ mesaId: string }>();

  useEffect(() => {
    if (!mesaId) {
      setIsLoading(false);
      return;
    }

    Promise.all([
      fetchProdutosVisiveis(),
      fetchMesaData(mesaId),
    ])
      .then(([produtosData, mesaData]) => {
        setProdutos(produtosData);
        setMesaData(mesaData);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [mesaId]);

  const isMesaOcupada = !!mesaData?.cliente_id;

  const handleOrder = async (produto: Produto, quantidade: number) => {
    if (!mesaId || !mesaData || !mesaData.user_id) {
      throw new Error("Mesa ou dados do estabelecimento não identificados.");
    }
    if (!isMesaOcupada) {
      throw new Error("A mesa não está ocupada. Não é possível adicionar pedidos.");
    }

    const userId = mesaData.user_id; // O user_id do dono do estabelecimento

    // 1. Verifica se já existe pedido aberto para a mesa
    let pedidoId: string | null = null;
    const { data: pedidoAberto, error: pedidoError } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", mesaId)
      .eq("status", "aberto")
      .single();

    if (pedidoError && pedidoError.code !== "PGRST116") throw pedidoError;

    if (pedidoAberto) {
      pedidoId = pedidoAberto.id;
    } else {
      // 2. Cria novo pedido aberto para a mesa (usando o cliente principal da mesa)
      const { data: novoPedido, error: novoPedidoError } = await supabase
        .from("pedidos")
        .insert({ 
          mesa_id: mesaId, 
          status: "aberto", 
          user_id: userId,
          cliente_id: mesaData.cliente_id, // Usando o cliente principal
        })
        .select("id")
        .single();
      if (novoPedidoError) throw novoPedidoError;
      pedidoId = novoPedido.id;
    }

    // 3. Insere o item no pedido
    const { error: itemError } = await supabase.from("itens_pedido").insert({
      pedido_id: pedidoId,
      nome_produto: produto.nome,
      quantidade: quantidade, // Usando a quantidade selecionada
      preco: produto.preco,
      status: "pendente",
      requer_preparo: produto.requer_preparo,
      user_id: userId, // Usando o user_id do dono do estabelecimento
      consumido_por_cliente_id: null, // Ocupante será definido pelo garçom, se necessário
    });
    if (itemError) throw itemError;
  };

  const renderContent = () => {
    if (isLoading) {
      return <Skeleton className="h-96" />;
    }

    if (!mesaData) {
      return (
        <Card className="mt-12 bg-red-900 text-white border-red-700">
          <CardHeader><CardTitle className="flex items-center"><Lock className="w-6 h-6 mr-2" /> Mesa Não Encontrada</CardTitle></CardHeader>
          <CardContent><p>O código QR desta mesa é inválido ou a mesa foi excluída.</p></CardContent>
        </Card>
      );
    }

    if (!isMesaOcupada) {
      return (
        <Card className="mt-12 bg-yellow-900 text-white border-yellow-700">
          <CardHeader><CardTitle className="flex items-center"><Lock className="w-6 h-6 mr-2" /> Mesa Livre</CardTitle></CardHeader>
          <CardContent><p>Esta mesa não está ocupada por um cliente. Por favor, chame um atendente para iniciar seu pedido.</p></CardContent>
        </Card>
      );
    }

    if (produtos.length === 0) {
      return <p className="text-center text-gray-300">Nenhum produto disponível no momento.</p>;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {produtos.map((produto) => (
          <PublicMenuProductCard key={produto.id} produto={produto} onOrder={handleOrder} />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        {isMesaOcupada && mesaId && (
          <Button variant="secondary" onClick={() => setIsSummaryOpen(true)}>
            <ReceiptText className="w-4 h-4 mr-2" />
            Ver Comanda
          </Button>
        )}
      </div>
      
      <h1 className="text-3xl font-bold mb-6 text-white text-center flex items-center justify-center gap-2">
        <Utensils className="w-6 h-6" />
        Cardápio da Mesa {mesaData?.numero || mesaId}
      </h1>
      {renderContent()}

      {mesaId && (
        <PublicOrderSummary
          isOpen={isSummaryOpen}
          onOpenChange={setIsSummaryOpen}
          mesaId={mesaId}
        />
      )}
    </div>
  );
}