import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Produto, Mesa, Categoria, ItemPedido, UserSettings } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Utensils, Lock, ReceiptText, DoorOpen, UserCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicMenuProductCard } from "@/components/menu-publico/PublicMenuProductCard";
import { PublicOrderSummary } from "@/components/menu-publico/PublicOrderSummary";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { showError, showSuccess } from "@/utils/toast";
import { ClientIdentificationModal } from "@/components/menu-publico/ClientIdentificationModal";
import { useQueryClient } from "@tanstack/react-query";

type MesaData = Mesa & { user_id: string };

type MenuData = {
  produtos: Produto[];
  categorias: Categoria[];
  settings: UserSettings | null;
};

type ItemToOrder = {
  produto: Produto;
  quantidade: number;
  observacoes: string;
};

async function fetchMenuData(mesaUserId: string): Promise<MenuData> {
  // Busca produtos que estão marcados para o menu
  const { data: produtos, error: produtosError } = await supabase
    .from("produtos")
    .select("*, categoria:categorias(nome)")
    .eq("mostrar_no_menu", true)
    .order("nome");
  if (produtosError) throw new Error(produtosError.message);

  // Busca todas as categorias
  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias")
    .select("*")
    .order("nome");
  if (categoriasError) throw new Error(categoriasError.message);
  
  // Busca configurações do Superadmin (para verificar se o estabelecimento está fechado)
  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("*")
    .eq("id", mesaUserId)
    .single();
  if (settingsError && settingsError.code !== 'PGRST116') {
    console.error("Erro ao buscar configurações do Superadmin:", settingsError);
  }

  return { produtos: produtos || [], categorias: categorias || [], settings: settings || null };
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
  const queryClient = useQueryClient();
  const [menuData, setMenuData] = useState<MenuData>({ produtos: [], categorias: [], settings: null });
  const [mesaData, setMesaData] = useState<MesaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isIdentificationOpen, setIsIdentificationOpen] = useState(false);
  const [identificationMode, setIdentificationMode] = useState<'order' | 'occupy'>('order'); // NOVO ESTADO
  const [itemToIdentify, setItemToIdentify] = useState<ItemToOrder | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const navigate = useNavigate();
  const { mesaId } = useParams<{ mesaId: string }>();

  const isMesaOcupada = !!mesaData?.cliente_id;
  const isClosed = menuData.settings?.establishment_is_closed || false;

  const refetchAll = () => {
    if (!mesaId || !mesaData?.user_id) return;
    setIsLoading(true);
    Promise.all([
      fetchMenuData(mesaData.user_id),
      fetchMesaData(mesaId),
    ])
      .then(([menuData, mesaData]) => {
        setMenuData(menuData);
        setMesaData(mesaData);
        queryClient.invalidateQueries({ queryKey: ["publicOrderSummary", mesaId] });
      })
      .catch(error => {
        console.error("Erro ao recarregar dados do menu:", error);
        showError("Erro ao recarregar dados do menu.");
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!mesaId) {
      setIsLoading(false);
      return;
    }

    // Primeiro, buscamos apenas os dados da mesa para obter o user_id
    fetchMesaData(mesaId)
      .then(data => {
        if (data && data.user_id) {
          setMesaData(data);
          return fetchMenuData(data.user_id);
        }
        throw new Error("Mesa ou ID do usuário não encontrado.");
      })
      .then(menuData => {
        setMenuData(menuData);
      })
      .catch(error => {
        console.error("Erro ao carregar dados do menu:", error);
        showError("Erro ao carregar dados do menu. Verifique o QR Code.");
      })
      .finally(() => setIsLoading(false));
  }, [mesaId]);

  const filteredProdutos = useMemo(() => {
    if (selectedCategory === "all") return menuData.produtos;
    return menuData.produtos.filter(p => p.categoria_id === selectedCategory);
  }, [menuData.produtos, selectedCategory]);

  const handleInitiateOrder = (produto: Produto, quantidade: number, observacoes: string) => {
    if (!mesaId || !mesaData || !mesaData.user_id) {
      showError("Erro interno: Dados da mesa ausentes.");
      return;
    }
    
    if (isClosed) {
      showError("O estabelecimento está fechado. Não é possível fazer pedidos.");
      return;
    }

    const isRodizioType = produto.tipo === 'rodizio' || produto.tipo === 'componente_rodizio';
    
    if (!isRodizioType && (produto.estoque_atual ?? 0) <= 0) {
      showError(`O produto "${produto.nome}" está indisponível no momento.`);
      return;
    }

    setItemToIdentify({ produto, quantidade, observacoes });
    setIdentificationMode('order');
    setIsIdentificationOpen(true);
  };
  
  const handleOccupyTable = () => {
    if (isClosed) {
      showError("O estabelecimento está fechado. Não é possível ocupar mesas.");
      return;
    }
    setIdentificationMode('occupy');
    setIsIdentificationOpen(true);
  };

  const handleOrderConfirmed = async (clienteId: string | null) => {
    if (!itemToIdentify || !mesaId || !mesaData || !mesaData.user_id) {
      showError("Erro interno: Dados do pedido ou da mesa ausentes.");
      return;
    }

    const { produto, quantidade, observacoes } = itemToIdentify;
    const userId = mesaData.user_id;
    const consumidoPorClienteId = clienteId;

    try {
      // 1. Se um cliente foi identificado, garante que ele é um ocupante (Edge Function add-occupant-public faz isso)
      if (consumidoPorClienteId) {
        await supabase.functions.invoke('add-occupant-public', {
          body: {
            mesa_id: mesaId,
            cliente_id: consumidoPorClienteId,
            user_id: mesaData.user_id,
          }
        });
      }

      // 2. Verifica se já existe pedido aberto para a mesa
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
        // 3. Cria novo pedido aberto para a mesa (usando o cliente principal da mesa)
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

      // 4. Insere o item no pedido
      let nomeProdutoFinal = produto.nome + (observacoes ? ` (${observacoes})` : '');
      let requerPreparo = produto.requer_preparo;
      let status: ItemPedido['status'] = 'pendente';

      if (produto.tipo === 'rodizio') {
          nomeProdutoFinal = `[RODIZIO] ${nomeProdutoFinal}`;
          requerPreparo = false;
      }
      
      if (produto.tipo === 'componente_rodizio') {
          requerPreparo = produto.requer_preparo;
      }
      
      const { error: itemError } = await supabase.from("itens_pedido").insert({
        pedido_id: pedidoId,
        nome_produto: nomeProdutoFinal,
        quantidade: quantidade,
        preco: produto.preco,
        status: status,
        requer_preparo: requerPreparo,
        user_id: userId,
        consumido_por_cliente_id: consumidoPorClienteId,
      });
      if (itemError) throw itemError;
      
      showSuccess(`Pedido de ${quantidade}x "${produto.nome}" adicionado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["publicOrderSummary", mesaId] });

    } catch (error: any) {
      console.error("Erro ao adicionar pedido:", error);
      showError(error.message || "Erro ao adicionar pedido. Verifique as permissões.");
    } finally {
      setItemToIdentify(null);
    }
  };
  
  const handleTableOccupied = (clienteId: string) => {
    // Após a ocupação bem-sucedida, recarrega os dados da mesa e do menu
    refetchAll();
    // Se havia um item pendente, inicia o fluxo de pedido para o cliente recém-alocado
    if (itemToIdentify) {
        handleOrderConfirmed(clienteId);
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
                disabled={isUnavailable || isClosed}
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

  if (isClosed) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 bg-background min-h-screen">
        <Card className="mt-12 bg-red-900 text-white border-red-700">
          <CardHeader><CardTitle className="flex items-center"><Lock className="w-6 h-6 mr-2" /> Estabelecimento Fechado</CardTitle></CardHeader>
          <CardContent><p>Desculpe, o estabelecimento está fechado e não está aceitando pedidos no momento.</p></CardContent>
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
          {isMesaOcupada ? (
            <Button variant="default" onClick={() => setIsSummaryOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg">
              <ReceiptText className="w-4 h-4 mr-2" />
              Ver Comanda
            </Button>
          ) : (
            <Button variant="default" onClick={handleOccupyTable} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
              <DoorOpen className="w-4 h-4 mr-2" />
              Ocupar Mesa
            </Button>
          )}
        </div>
        
        {/* 2. Título Fixo */}
        <h1 className="text-3xl font-serif font-bold mb-6 text-primary text-center flex items-center justify-center gap-2 tracking-wider">
          <Utensils className="w-6 h-6" />
          Cardápio da Mesa {mesaData?.numero || mesaId}
        </h1>
        
        {/* Alerta de Mesa Livre */}
        {!isMesaOcupada && (
            <Card className="mb-4 bg-yellow-100 border-yellow-500 text-yellow-800">
                <CardContent className="p-3 flex items-center gap-3">
                    <UserCheck className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">
                        Mesa Livre. Clique em "Ocupar Mesa" para iniciar seu atendimento e fazer pedidos.
                    </p>
                </CardContent>
            </Card>
        )}

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
        mode={identificationMode}
        onOrderConfirmed={handleOrderConfirmed}
        onTableOccupied={handleTableOccupied}
      />
    </div>
  );
}