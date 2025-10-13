import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export function WelcomeCard() {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Bem-vindo ao Fidelize!</CardTitle>
          <CardDescription>
            Parece que você ainda não tem clientes cadastrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-muted-foreground">
            Para começar a usar o reconhecimento facial e gerenciar seus clientes, o primeiro passo é adicionar seu primeiro cliente ao sistema.
          </p>
          <Button asChild size="lg">
            <Link to="/clientes">
              <UserPlus className="w-5 h-5 mr-2" />
              Cadastrar Primeiro Cliente
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}