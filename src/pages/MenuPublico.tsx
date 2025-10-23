import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Produto, Mesa, Categoria } from "@/types/supabase";
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
    
    const isRodizioType = produto.tipo === 'rodizio' || produto.tipo === 'componente_rodizio';
    
    // Verifica estoque APENAS se for produto de venda
    if (!isRodizioType && (produto.estoque_atual ?? 0) <= 0) {
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
      
      let nomeProdutoFinal = produto.nome + (observacoes ? ` (${observacoes})` : '');
      let requerPreparo = produto.requer_preparo;
      let status: ItemPedido['status'] = 'pendente';

      // Se for Pacote Rodízio, prefixamos e forçamos requer_preparo: false.
      if (produto.tipo === 'rodizio') {
          nomeProdutoFinal = `[RODIZIO] ${nomeProdutoFinal}`;
          requerPreparo = false;
      }
      
      // Se for Item de Rodízio, usamos o valor de requer_preparo do produto.
      if (produto.tipo === 'componente_rodizio') {
          requerPreparo = produto.requer_preparo;
      }
      
      // Se for item de Venda e não requer preparo, marca como entregue.
      if (produto.tipo === 'venda' && !requerPreparo) {
          status = 'entregue';
      }

      const { error: itemError } = await supabase.from("itens_pedido").insert({
        pedido_id: pedidoId,
        nome_produto: nomeProdutoFinal,
        quantidade: quantidade,
        preco: produto.preco,
        status: status,
        requer_preparo: requerPreparo,
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

  const renderMenuContent = () => {
    if (menuData.produtos.length === 0) {
      return <p className="col-span-full text-center text-muted-foreground py-10">Nenhum produto nesta categoria.</p>;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
        {filteredProdutos.length > 0 ? (
          filteredProdutos.map((produto) => {
            const isRodizioType = produto.tipo === 'rodizio' || produto.tipo === 'componente_rodizio';
            const isUnavailable = !isRodizioType && (produto.estoque_atual ?? 0) <= 0;
            
            return (
              <PublicMenuProductCard 
                key={produto.id} 
                produto={produto} 
                onInitiateOrder={handleInitiateOrder} 
                disabled={isUnavailable}
              />
            );
          })
        ) : (
          <p className="col-span-full text-center text-muted-foreground py-10">Nenhum produto nesta categoria.</p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <Skeleton className="h-screen w-full" />;
  }

  if (!mesaId || !mesaData) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 bg-background min-h-screen">
        <Card className="mt-12 bg-red-900 text-white border-red-700">
          <CardHeader><CardTitle className="flex items-center"><Lock className="w-6 h-6 mr-2" /> Mesa Não Encontrada</CardTitle></CardHeader>
          <CardContent><p>O código QR desta mesa é inválido ou a mesa foi excluída.</p></CardContent>
        </Card>
      </div>
    );
  }

  if (!isMesaOcupada) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 bg-background min-h-screen">
        <Card className="mt-12 bg-yellow-900 text-white border-yellow-700">
          <CardHeader><CardTitle className="flex items-center"><Lock className="w-6 h-6 mr-2" /> Mesa Livre</CardTitle></CardHeader>
          <CardContent><p>Esta mesa não está ocupada por um cliente. Por favor, chame um atendente para iniciar seu pedido.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 shrink-0">
        {/* 1. Header Fixo */}
        <div className="flex justify-between items-center mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-foreground hover:bg-primary/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          {isMesaOcupada && mesaId && (
            <Button variant="default" onClick={() => setIsSummaryOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              <ReceiptText className="w-4 h-4 mr-2" />
              Ver Comanda
            </Button>
          )}
        </div>
        
        {/* 2. Título Fixo */}
        <h1 className="text-3xl font-serif font-bold mb-6 text-primary text-center flex items-center justify-center gap-2 tracking-wider">
          <Utensils className="w-6 h-6" />
          Cardápio da Mesa {mesaData?.numero || mesaId}
        </h1>

        {/* 3. Filtro de Categorias Fixo */}
        <ScrollArea className="w-full whitespace-nowrap rounded-md border border-primary/30 bg-card/50 shadow-lg mb-4">
          <div className="flex w-max space-x-2 p-2">
            <Button 
              variant={selectedCategory === "all" ? "default" : "ghost"} 
              onClick={() => setSelectedCategory("all")}
              className={cn(selectedCategory === "all" ? "bg-primary text-primary-foreground shadow-md" : "text-foreground hover:bg-primary/10")}
            >
              Todos
            </Button>
            {menuData.categorias.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "ghost"}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(selectedCategory === cat.id ? "bg-primary text-primary-foreground shadow-md" : "text-foreground hover:bg-primary/10")}
              >
                {cat.nome}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* 4. Lista de Produtos Rolável */}
      <div className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full">
        {renderMenuContent()}
      </div>

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