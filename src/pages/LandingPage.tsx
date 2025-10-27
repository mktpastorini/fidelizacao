import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle, ScanFace, MessageCircle, Star, Shield, ChefHat, BarChart2, LucideIcon } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";

// --- Componentes da Página ---

const Nav = () => (
  <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
      <div className="flex items-center gap-2">
        <ScanFace className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">Fidelize</span>
      </div>
      <nav className="flex items-center gap-4">
        <Button>Agendar Demonstração</Button>
      </nav>
    </div>
  </header>
);

const HeroSection = () => (
  <section className="container grid lg:grid-cols-2 gap-12 items-center py-20 md:py-32">
    <div className="flex flex-col items-start gap-6">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
        Transforme Visitantes em Clientes Fiéis com IA
      </h1>
      <p className="text-lg text-muted-foreground">
        O Fidelize usa reconhecimento facial para criar experiências personalizadas, automatizar a comunicação e aumentar a retenção de clientes no seu restaurante.
      </p>
      <div className="flex gap-4">
        <Button size="lg">Quero Fidelizar Meus Clientes</Button>
        <Button size="lg" variant="outline">Ver Funcionalidades</Button>
      </div>
    </div>
    <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
      {/* Substitua este vídeo pelo seu vídeo de demonstração */}
      <video className="rounded-lg w-full h-full object-cover" autoPlay loop muted playsInline>
        <source src="/ia.mp4" type="video/mp4" />
        Seu navegador não suporta o vídeo.
      </video>
    </div>
  </section>
);

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <Card className="bg-card/50 hover:bg-card transition-all hover:shadow-lg hover:-translate-y-1">
    <CardHeader className="flex flex-row items-center gap-4">
      <Icon className="w-8 h-8 text-primary" />
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const FeaturesSection = () => (
  <section className="container py-20 md:py-28">
    <div className="text-center max-w-3xl mx-auto mb-12">
      <h2 className="text-3xl md:text-4xl font-bold">Uma Plataforma Completa para o Seu Negócio</h2>
      <p className="text-lg text-muted-foreground mt-4">
        Do reconhecimento na porta à análise de dados, o Fidelize tem tudo que você precisa para crescer.
      </p>
    </div>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FeatureCard
        icon={ScanFace}
        title="Reconhecimento Facial Inteligente"
        description="Identifique clientes na chegada, no caixa e até na saída, acionando alertas para contas abertas e personalizando o atendimento."
      />
      <FeatureCard
        icon={MessageCircle}
        title="Automação de Mensagens"
        description="Envie mensagens de boas-vindas, pós-pagamento e aniversário via WhatsApp, tudo de forma automática e personalizada."
      />
      <FeatureCard
        icon={Star}
        title="Programa de Fidelidade por Pontos"
        description="Recompense seus clientes a cada visita. Eles acumulam pontos e podem resgatar por prêmios, incentivando o retorno."
      />
      <FeatureCard
        icon={Shield}
        title="Prevenção de Fraudes"
        description="Ações sensíveis como aplicar descontos ou liberar mesas exigem aprovação de um gerente, garantindo total controle e auditoria."
      />
      <FeatureCard
        icon={ChefHat}
        title="Gestão de Cozinha e Delivery"
        description="Otimize o tempo de preparo com nosso Kanban inteligente e gerencie pedidos de delivery, incluindo integração total com iFood."
      />
      <FeatureCard
        icon={BarChart2}
        title="Relatórios e Análises"
        description="Acompanhe o faturamento, ticket médio, desempenho dos garçons e muito mais com dashboards intuitivos."
      />
    </div>
  </section>
);

const CtaSection = () => (
  <section className="bg-muted py-20">
    <div className="container text-center max-w-4xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold">Pronto para Levar Seu Restaurante para o Próximo Nível?</h2>
      <p className="text-lg text-muted-foreground mt-4">
        Descubra como o Fidelize pode aumentar seu faturamento e criar uma base de clientes leais.
      </p>
      <Button size="lg" className="mt-8">Agende uma Demonstração Gratuita</Button>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t">
    <div className="container py-8 text-center text-muted-foreground text-sm">
      © {new Date().getFullYear()} Fidelize. Todos os direitos reservados.
    </div>
  </footer>
);

export default function LandingPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="bg-background text-foreground">
        <Nav />
        <main>
          <HeroSection />
          <FeaturesSection />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}