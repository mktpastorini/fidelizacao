import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Produto } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicMenuProductCard } from "@/components/menu-publico/PublicMenuProductCard";

async function fetchProdutosVisiveis(): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("mostrar_no_menu", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data || [];
}

export default function MenuPublicoPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { mesaId } = useParams();

  useEffect(() => {
    fetchProdutosVisiveis()
      .then(setProdutos)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleOrder = async (produto: Produto) => {
    if (!mesaId) throw new Error("Mesa não identificada.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    // Verifica se já existe pedido aberto para a mesa
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
      // Cria novo pedido aberto para a mesa
      const { data: novoPedido, error: novoPedidoError } = await supabase
        .from("pedidos")
        .insert({ mesa_id: mesaId, status: "aberto", user_id: user.id })
        .select("id")
        .single();
      if (novoPedidoError) throw novoPedidoError;
      pedidoId = novoPedido.id;
    }

    // Insere o item no pedido
    const { error: itemError } = await supabase.from("itens_pedido").insert({
      pedido_id: pedidoId,
      nome_produto: produto.nome,
      quantidade: 1,
      preco: produto.preco,
      status: "pendente",
      requer_preparo: produto.requer_preparo,
      user_id: user.id,
      consumido_por_cliente_id: null,
    });
    if (itemError) throw itemError;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 min-h-screen">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 text-white">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-3xl font-bold mb-6 text-white text-center">Cardápio da Mesa {mesaId}</h1>
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : produtos.length === 0 ? (
        <p className="text-center text-gray-300">Nenhum produto disponível no momento.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {produtos.map((produto) => (
            <PublicMenuProductCard key={produto.id} produto={produto} onOrder={handleOrder} />
          ))}
        </div>
      )}
    </div>
  );
}