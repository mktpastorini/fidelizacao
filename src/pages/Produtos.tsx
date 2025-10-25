import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Produto, Categoria } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProdutoForm } from "@/components/produtos/ProdutoForm";
import { ProdutoCard } from "@/components/produtos/ProdutoCard";
import { CategoriaManager } from "@/components/produtos/CategoriaManager";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, FileCog } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageActions } from "@/contexts/PageActionsContext";
import { useEffect } from "react";
import { useSuperadminId } from "@/hooks/useSuperadminId";

async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  if (error) throw error;
  return data || [];
}

export default function ProdutosPage() {
  const queryClient = useQueryClient();
  const { setPageActions } = usePageActions();
  const { superadminId } = useSuperadminId();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: produtos, isLoading: isLoadingProdutos } = useQuery({ queryKey: ["produtos"], queryFn: fetchProdutos });
  const { data: categorias, isLoading: isLoadingCategorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });

  const handleFormOpen = (produto: Produto | null = null) => {
    setEditingProduto(produto);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingProduto(null);
    setIsFormOpen(false);
  };

  const addProdutoMutation = useMutation({
    mutationFn: async (newProduto: Omit<Produto, 'id' | 'created_at'>) => {
      if (!superadminId) throw new Error("ID do Super Admin não encontrado.");
      const { error } = await supabase.from("produtos").insert([{ ...newProduto, user_id: superadminId }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto adicionado!");
      handleFormClose();
    },
    onError: (err: Error) => showError(err.message),
  });

  const editProdutoMutation = useMutation({
    mutationFn: async (updatedProduto: Partial<Produto>) => {
      const { id, ...produtoInfo } = updatedProduto;
      const { error } = await supabase.from("produtos").update(produtoInfo).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto atualizado!");
      handleFormClose();
    },
    onError: (err: Error) => showError(err.message),
  });

  const deleteProdutoMutation = useMutation({
    mutationFn: async (produtoId: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", produtoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto excluído!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleSubmit = (values: any) => {
    if (editingProduto) {
      editProdutoMutation.mutate({ ...values, id: editingProduto.id });
    } else {
      addProdutoMutation.mutate(values);
    }
  };

  const filteredProdutos = useMemo(() => {
    if (!produtos) return [];
    if (selectedCategory === "all") return produtos;
    return produtos.filter(p => p.categoria_id === selectedCategory);
  }, [produtos, selectedCategory]);

  // Define os botões da página no Header
  useEffect(() => {
    const pageButtons = (
      <>
        <Button variant="outline" onClick={() => setIsCategoryManagerOpen(true)}>
          <FileCog className="w-4 h-4 mr-2" /> Gerenciar Categorias
        </Button>
        <Button onClick={() => handleFormOpen()}><PlusCircle className="w-4 h-4 mr-2" />Adicionar Produto</Button>
      </>
    );
    setPageActions(pageButtons);

    return () => setPageActions(null);
  }, [setPageActions]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Cardápio / Produtos</h1>
        <p className="text-muted-foreground mt-2">Navegue pelas categorias e gerencie seu catálogo.</p>
      </div>

      {isLoadingCategorias ? <Skeleton className="h-10 w-full" /> : (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categorias?.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id}>{cat.nome}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoadingProdutos ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : filteredProdutos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
          {filteredProdutos.map((produto) => (
            <ProdutoCard
              key={produto.id}
              produto={produto}
              onEdit={() => handleFormOpen(produto)}
              onDelete={() => deleteProdutoMutation.mutate(produto.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card rounded-lg mt-6">
          <p className="text-muted-foreground">Nenhum produto encontrado nesta categoria.</p>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduto ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
          </DialogHeader>
          <ProdutoForm
            onSubmit={handleSubmit}
            isSubmitting={addProdutoMutation.isPending || editProdutoMutation.isPending}
            defaultValues={editingProduto || undefined}
            categorias={categorias || []}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerenciar Categorias</DialogTitle></DialogHeader>
          <CategoriaManager />
        </DialogContent>
      </Dialog>
    </div>
  );
}