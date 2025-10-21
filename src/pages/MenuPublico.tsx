import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Produto, Mesa, Categoria, ItemPedido } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Utensils, Lock, ReceiptText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicMenuProductCard } from "@/components/menu-publico/PublicMenuProductCard";
import { PublicOrderSummary } from "@/components/menu-publico/PublicOrderSummary";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { showError, showSuccess } from "@/utils/toast";
import { ClientIdentificationModal } from "@/components/menu-publico/ClientIdentificationModal";

type MesaData = Mesa & { user_id: string };

type MenuData = {
  produtos: Produto[];
  categorias: Categoria[];
};

type ItemToOrder = {
  produto: Produto;
  quantidade: number;
  observacoes: string;
};

async function fetchMenuData(): Promise<MenuData> {
  const { data: produtos, error: produtosError } = await supabase
    .from("produtos")
    .select("*, categoria:categorias(nome)")
    .eq("mostrar_no_menu", true)
    .order("nome");
  if (produtosError) throw new Error(produtosError.message);

  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");
  if (categoriasError) throw new Error(categoriasError.message);

  return { produtos: produtos || [], categorias: categorias || [] };
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
  const [menuData, setMenuData] = useState<MenuData>({ produtos: [], categorias: [] });
  const [mesaData, setMesaData] = useState<MesaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isIdentificationOpen, setIsIdentificationOpen] = useState(false);
  const [itemToIdentify, setItemToIdentify] = useState<ItemToOrder | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const navigate = useNavigate();
  const { mesaId } = useParams<{ mesaId: string }>();

  useEffect(() => {
    if (!mesaId) {
      setIsLoading(false);
      return;
    }

    Promise.all([
      fetchMenuData(),
      fetchMesaData(mesaId),
    ])
      .then(([menuData, mesaData]) => {
        setMenuData(menuData);
        setMesaData(mesaData);
      })
      .catch(error => {
        console.error("Erro ao carregar dados do menu:", error);
        showError("Erro ao carregar dados do menu. Verifique o QR Code.");
      })
      .finally(() => setIsLoading(false));
  }, [mesaId]);

  const isMesaOcupada = !!mesaData?.cliente_id;

  const filteredProdutos = useMemo(() => {
    if (selectedCategory === "all") return menuData.produtos;
    return menuData.produtos.filter(p => p.categoria_id === selectedCategory);
  }, [menuData.produtos, selectedCategory]);

  const handleInitiateOrder = (produto: Produto, quantidade: number, observacoes: string) => {
    if (!mesaId || !mesaData || !isMesaOcupada) {
      showError("A mesa não está ocupada. Não é possível adicionar pedidos.");
      return;
    }
    if (produto.estoque_atual <= 0) {
      showError(`O produto "${produto.nome}" está indisponível no momento.`);
      return;
    }

    setItemToIdentify({ produto, quantidade, observacoes });
    setIsIdentificationOpen(true);
  };

  const handleOrderConfirmed = async (clienteId: string | null) => {
    if (!itemToIdentify || !mesaId || !mesaData || !mesaData.user_id) {
      showError("Erro interno: Dados do pedido ou da mesa ausentes.");
      return;
    }

    const { produto, quantidade, observacoes } = itemToIdentify;
    const userId = mesaData.user_id;

    try {
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
            cliente_id: mesaData.cliente_id,
          })
          .select("id")
          .single();
        if (novoPedidoError) throw novoPedidoError;
        pedidoId = novoPedido.id;
      }

      // 3. Insere o item no pedido
      // Lógica de correção: Se não requer preparo, o status inicial é 'entregue'
      const status: ItemPedido['status'] = produto.requer_preparo ? 'pendente' : 'entregue'; 

      const { error: itemError } = await supabase.from("itens_pedido").insert({
        pedido_id: pedidoId,
        nome_produto: produto.nome + (observacoes ? ` (${observacoes})` : ''),
        quantidade: quantidade,
        preco: produto.preco,
        status: status,
        requer_preparo: produto.requer_preparo,
        user_id: userId,
        consumido_por_cliente_id: clienteId, // Usa o ID do cliente identificado ou null (Mesa Geral)
      });
      if (itemError) throw itemError;
      
      showSuccess(`Pedido de ${quantidade}x "${produto.nome}" adicionado com sucesso!`);

    } catch (error: any) {
      console.error("Erro ao adicionar pedido:", error);
      showError(error.message || "Erro ao adicionar pedido. Verifique as permissões.");
    } finally {
      setItemToIdentify(null);
    }
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

    if (menuData.produtos.length === 0) {
      return <p className="text-center text-gray-300">Nenhum produto disponível no momento.</p>;
    }

    return (
      <div className="space-y-6">
        {/* Filtro de Categorias */}
        <ScrollArea className="w-full whitespace-nowrap rounded-md border bg-gray-800">
          <div className="flex w-max space-x-2 p-2">
            <Button 
              variant={selectedCategory === "all" ? "default" : "ghost"} 
              onClick={() => setSelectedCategory("all")}
              className={cn(selectedCategory === "all" ? "bg-primary text-primary-foreground" : "text-white hover:bg-gray-700")}
            >
              Todos
            </Button>
            {menuData.categorias.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "ghost"}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "text-white hover:bg-gray-700")}
              >
                {cat.nome}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Lista de Produtos */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProdutos.length > 0 ? (
            filteredProdutos.map((produto) => (
              <PublicMenuProductCard 
                key={produto.id} 
                produto={produto} 
                onInitiateOrder={handleInitiateOrder} 
                disabled={produto.estoque_atual <= 0} 
              />
            ))
          ) : (
            <p className="col-span-full text-center text-gray-400 py-10">Nenhum produto nesta categoria.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-gray-900 min-h-screen">
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

      {/* Modal de Identificação Facial */}
      <ClientIdentificationModal
        isOpen={isIdentificationOpen}
        onOpenChange={setIsIdentificationOpen}
        itemToOrder={itemToIdentify}
        mesaId={mesaId || ''}
        mesaUserId={mesaData?.user_id || ''}
        onOrderConfirmed={handleOrderConfirmed}
      />
    </div>
  );
}