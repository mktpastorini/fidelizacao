import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Categoria } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Skeleton } from "../ui/skeleton";
import { useSuperadminId } from "@/hooks/useSuperadminId";

async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  if (error) throw error;
  return data || [];
}

export function CategoriaManager() {
  const queryClient = useQueryClient();
  const { superadminId } = useSuperadminId();
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: categorias, isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: fetchCategorias,
  });

  const addMutation = useMutation({
    mutationFn: async (nome: string) => {
      if (!superadminId) throw new Error("ID do Super Admin não encontrado.");
      const { error } = await supabase.from("categorias").insert({ nome, user_id: superadminId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      showSuccess("Categoria adicionada!");
      setNewCategoryName("");
    },
    onError: (err: Error) => showError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias"] });
      showSuccess("Categoria excluída!");
    },
    onError: (err: Error) => showError(err.message),
  });

  const handleAdd = () => {
    if (newCategoryName.trim()) {
      addMutation.mutate(newCategoryName.trim());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nome da nova categoria"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={addMutation.isPending}>
          {addMutation.isPending ? "Adicionando..." : "Adicionar"}
        </Button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : categorias?.map(cat => (
          <div key={cat.id} className="flex items-center justify-between p-2 rounded-md bg-secondary">
            <span className="font-medium">{cat.nome}</span>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}