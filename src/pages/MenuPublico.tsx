import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Produto } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Utensils } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { PublicMenuProductCard } from "@/components/menu-publico/PublicMenuProductCard";
import { showError, showSuccess } from "@/utils/toast";

type CategoriaComProdutos = {
  id: string;
  nome: string;
  produtos: Produto[];
};

async function fetchMenuData(): Promise<{ produtos: Produto[], categorias: { id: string, nome: string }[] }> {
  const { data: produtos, error: produtosError } = await supabase
    .from("produtos")
    .select("*, categoria:categorias(nome)")
    .eq("mostrar_no_menu", true)
    .order("nome");
  if (produtosError) throw new Error(produtosError.message);

  const { data: categorias, error: categoriasError } = await supabase
    .from("categorias")
    .select("id, nome")
    .order("nome");
  if (categoriasError) throw new Error(categoriasError.message);

  return { produtos: produtos || [], categorias: categorias || [] };
}

export default function MenuPublicoPage() {
  const [menuData, setMenuData] = useState<{ produtos: Produto[], categorias: { id: string, nome: string }[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { mesaId } = useParams<{ mesaId: string }>();

  useEffect(() => {
    if (!mesaId) {
      setError("ID da Mesa não fornecido.");
      setIsLoading(false);
      return;
    }
    fetchMenuData()
      .then(setMenuData)
      .catch((err) => {
        console.error(err);
        setError("Não foi possível carregar o cardápio. Tente novamente mais tarde.");
      })
      .finally(() => setIsLoading(false));
  }, [mesaId]);

  const handleOrder = async (produto: Produto) => {
    if (!mesaId) {
      throw new Error("Mesa não identificada.");
    }

    // O menu público não deve depender de um usuário logado no frontend.
    // No entanto, para inserir no DB, precisamos do user_id do estabelecimento.
    // Como não temos autenticação aqui, vamos assumir que o user_id deve ser
    // buscado através da mesa, que está ligada ao user_id do estabelecimento.
    
    // 1. Buscar o user_id do estabelecimento através da mesa
    const { data: mesaData, error: mesaError } = await supabase
      .from("mesas")
      .select("user_id")
      .eq("id", mesaId)
      .single();

    if (mesaError || !mesaData?.user_id) {
      throw new Error("Mesa inválida ou não encontrada.");
    }
    const userId = mesaData.user_id;

    // 2. Verificar/Criar pedido aberto para a mesa
    let pedidoId: string | null = null;
    const { data: pedidoAberto, error: pedidoError } = await supabase
      .from("pedidos")
      .select("id")
      .eq("mesa_id", mesaId)
      .eq("status", "aberto")
      .maybeSingle();

    if (pedidoError && pedidoError.code !== "PGRST116") throw pedidoError;

    if (pedidoAberto) {
      pedidoId = pedidoAberto.id;
    } else {
      // Cria novo pedido aberto para a mesa
      const { data: novoPedido, error: novoPedidoError } = await supabase
        .from("pedidos")
        .insert({ mesa_id: mesaId, status: "aberto", user_id: userId })
        .select("id")
        .single();
      if (novoPedidoError) throw novoPedidoError;
      pedidoId = novoPedido.id;
    }

    // 3. Insere o item no pedido
    const { error: itemError } = await supabase.from("itens_pedido").insert({
      pedido_id: pedidoId,
      nome_produto: produto.nome,
      quantidade: 1,
      preco: produto.preco,
      status: "pendente",
      requer_preparo: produto.requer_preparo,
      user_id: userId, // Usando o user_id do estabelecimento
      consumido_por_cliente_id: null, // Cliente não identificado no menu público
    });
    if (itemError) throw itemError;
  };

  const groupedProducts = useMemo(() => {
    if (!menuData) return [];
    
    const groups = new Map<string, Produto[]>();
    
    // Agrupa produtos por categoria
    menuData.produtos.forEach(p => {
      const categoryId = p.categoria_id || 'sem_categoria';
      if (!groups.has(categoryId)) {
        groups.set(categoryId, []);
      }
      groups.get(categoryId)!.push(p);
    });

    // Mapeia para o formato final, incluindo categorias vazias para ordenação
    const result: CategoriaComProdutos[] = [];
    
    // Adiciona a categoria "Sem Categoria" primeiro se houver produtos nela
    const uncategorizedProducts = groups.get('sem_categoria');
    if (uncategorizedProducts && uncategorizedProducts.length > 0) {
        result.push({ id: 'sem_categoria', nome: 'Sem Categoria', produtos: uncategorizedProducts });
    }

    // Adiciona as categorias ordenadas
    menuData.categorias.forEach(cat => {
        const products = groups.get(cat.id) || [];
        if (products.length > 0) {
            result.push({ id: cat.id, nome: cat.nome, produtos: products });
        }
    });

    return result;
  }, [menuData]);

  if (isLoading) {
    return <Skeleton className="h-screen w-full bg-gray-900" />;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-gray-900 min-h-screen text-white text-center">
        <h1 className="text-3xl font-bold mb-4">Erro</h1>
        <p className="text-red-400">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-white hover:bg-gray-800">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold text-white">Cardápio da Mesa {mesaId?.substring(0, 4)}...</h1>
        <div className="w-20"></div> {/* Placeholder para centralizar o título */}
      </div>
      
      {groupedProducts.length === 0 ? (
        <p className="text-center text-gray-300 py-12">Nenhum produto disponível no momento.</p>
      ) : (
        <div className="space-y-8">
          {groupedProducts.map(group => (
            <div key={group.id}>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <Utensils className="w-6 h-6 mr-2 text-primary" />
                {group.nome}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {group.produtos.map((produto) => (
                  <PublicMenuProductCard key={produto.id} produto={produto} onOrder={handleOrder} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}