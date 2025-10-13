import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Produto } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProdutoForm } from "@/components/produtos/ProdutoForm";
import { PlusCircle, MoreHorizontal, Trash2, Edit } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export default function ProdutosPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);

  const { data: produtos, isLoading, isError } = useQuery({
    queryKey: ["produtos"],
    queryFn: fetchProdutos,
  });

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) setEditingProduto(null);
    setIsDialogOpen(isOpen);
  };

  const addProdutoMutation = useMutation({
    mutationFn: async (newProduto: Omit<Produto, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("produtos").insert([{ ...newProduto, user_id: user?.id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      showSuccess("Produto adicionado!");
      handleDialogChange(false);
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
      handleDialogChange(false);
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

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-gray-600 mt-2">Gerencie seu catálogo de produtos e serviços.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="w-4 h-4 mr-2" />Adicionar Produto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProduto ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
            </DialogHeader>
            <ProdutoForm
              onSubmit={handleSubmit}
              isSubmitting={addProdutoMutation.isPending || editProdutoMutation.isPending}
              defaultValues={editingProduto || undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {isLoading ? <p>Carregando produtos...</p> : isError ? <p className="text-red-500">Erro ao carregar produtos.</p> : produtos && produtos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((produto) => (
                <TableRow key={produto.id}>
                  <TableCell className="font-medium">{produto.nome}</TableCell>
                  <TableCell>{formatCurrency(produto.preco)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setEditingProduto(produto); setIsDialogOpen(true); }}>
                          <Edit className="w-4 h-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500" onClick={() => deleteProdutoMutation.mutate(produto.id)} disabled={deleteProdutoMutation.isPending}>
                          <Trash2 className="w-4 h-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum produto cadastrado ainda.</p>
            <p className="text-gray-500">Clique em "Adicionar Produto" para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
}