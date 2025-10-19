import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Produto } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>
      <h1 className="text-3xl font-bold mb-6 text-center">Cardápio da Mesa {mesaId}</h1>
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : produtos.length === 0 ? (
        <p className="text-center text-muted-foreground">Nenhum produto disponível no momento.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {produtos.map((produto) => (
            <Card key={produto.id} className="cursor-default">
              <CardHeader>
                <CardTitle>{produto.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">{produto.descricao || "Sem descrição"}</p>
                <p className="font-semibold">R$ {produto.preco.toFixed(2).replace('.', ',')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}