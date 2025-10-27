import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScanFace, MessageCircle, Star, Shield, ChefHat, BarChart2, LucideIcon, QrCode, ClipboardList, Sparkles } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useState, useEffect, useCallback } from "react";

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

const VIDEO_URLS = [
  "/ia.mp4",
  "/ia4.mp4",
  "/ia2.mp4",
  "/ia3.mp4",
];

const HeroSection = () => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  useEffect(() => {
    setCurrentVideoIndex(Math.floor(Math.random() * VIDEO_URLS.length));
  }, []);

  const loadNextVideo = useCallback(() => {
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % VIDEO_URLS.length);
  }, []);

  const videoUrl = VIDEO_URLS[currentVideoIndex];

  return (
    <section className="container grid lg:grid-cols-2 gap-12 items-center py-20 md:py-32">
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
          Da Porta à Mesa: A Revolução do Atendimento que Conhece seu Cliente.
        </h1>
        <p className="text-lg text-muted-foreground">
          Reconhecimento facial na chegada, pedidos inteligentes na mesa e segurança total no caixa. Transforme cada visita em uma experiência memorável e lucrativa.
        </p>
        <div className="flex gap-4">
          <Button size="lg">Quero Fidelizar Meus Clientes</Button>
          <Button size="lg" variant="outline">Ver Funcionalidades</Button>
        </div>
      </div>
      <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
        <video key={videoUrl} className="rounded-lg w-full h-full object-cover" autoPlay loop={false} muted playsInline onEnded={loadNextVideo}>
          <source src={videoUrl} type="video/mp4" />
          Seu navegador não suporta o vídeo.
        </video>
      </div>
    </section>
  );
};

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
      <h2 className="text-3xl md:text-4xl font-bold">Mais que um Sistema, uma Revolução no seu Atendimento</h2>
      <p className="text-lg text-muted-foreground mt-4">
        Descubra as ferramentas que vão encantar seus clientes e proteger seu caixa.
      </p>
    </div>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FeatureCard
        icon={ScanFace}
        title="Atendimento VIP Automático"
        description="Nosso sistema reconhece seus clientes na chegada, exibindo nome, preferências e histórico. Surpreenda-os com um serviço que parece ler mentes."
      />
      <FeatureCard
        icon={Shield}
        title="Segurança Antifraude e Alertas de Saída"
        description="Ações sensíveis como descontos exigem aprovação de um gerente. E mais: nosso sistema alerta em tempo real com um aviso sonoro se um cliente com conta aberta tentar sair."
      />
      <FeatureCard
        icon={Star}
        title="Operação de Salão sem Estresse"
        description="Chega de caixas perdidos ou comandas confusas. O Fidelize acompanha a movimentação dos clientes, mesmo que troquem de mesa, garantindo um fechamento de conta rápido e sem erros."
      />
      <FeatureCard
        icon={MessageCircle}
        title="Comunicação que Fideliza"
        description="Mantenha o relacionamento aquecido com mensagens automáticas de boas-vindas, pós-pagamento e aniversário via WhatsApp. Tudo personalizado para criar uma conexão real."
      />
      <FeatureCard
        icon={QrCode}
        title="Cardápio Digital com QR Code"
        description="Gere QR Codes para cada mesa e ofereça um cardápio digital sempre atualizado. Reduza custos de impressão e permita que seus clientes explorem seus pratos de forma interativa."
      />
      <FeatureCard
        icon={ClipboardList}
        title="Estoque Inteligente, Lucro Máximo"
        description="Receba alertas de estoque baixo, controle o custo de cada prato e evite desperdícios. Saiba exatamente quando comprar e nunca mais perca uma venda por falta de insumos."
      />
      <FeatureCard
        icon={Sparkles}
        title="A Mágica Acontece na Mesa"
        description="Nosso sistema identifica clientes (novos e recorrentes) diretamente na mesa. Clientes novos fazem um cadastro rápido e automático em segundos, enquanto os recorrentes são recebidos com suas preferências."
      />
      <FeatureCard
        icon={ChefHat}
        title="Cozinha e Delivery de Alta Performance"
        description="Otimize o tempo de preparo com nosso Kanban inteligente e gerencie pedidos de delivery, incluindo integração total com iFood, para garantir entregas rápidas e clientes satisfeitos."
      />
      <FeatureCard
        icon={BarChart2}
        title="Decisões Baseadas em Dados"
        description="Entenda seu negócio a fundo. Acompanhe faturamento, ticket médio, desempenho da equipe e produtos mais vendidos com dashboards claros e objetivos."
      />
    </div>
  </section>
);

const FaqSection = () => (
  <section className="container py-20 md:py-28 max-w-4xl mx-auto">
    <div className="text-center mb-12">
      <h2 className="text-3xl md:text-4xl font-bold">Perguntas Frequentes</h2>
    </div>
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>O que eu preciso para usar o reconhecimento facial?</AccordionTrigger>
        <AccordionContent>
          Apenas uma webcam de boa qualidade. Nossa equipe cuida de toda a configuração técnica do sistema de reconhecimento para você, garantindo que tudo funcione perfeitamente.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Como funciona o cadastro rápido na mesa para novos clientes?</AccordionTrigger>
        <AccordionContent>
          É simples! Ao sentar, o cliente pode optar por um cadastro rápido via câmera. Em segundos, o sistema captura a foto, pede o nome e o contato, e o cliente já está no seu banco de dados, pronto para receber um atendimento personalizado e acumular pontos de fidelidade desde a primeira visita.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Meus dados estão seguros?</AccordionTrigger>
        <AccordionContent>
          Sim. Utilizamos tecnologia de ponta com segurança de nível empresarial. Isso garante que seus dados só podem ser acessados por usuários autorizados da sua equipe.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-4">
        <AccordionTrigger>Posso personalizar as mensagens enviadas aos clientes?</AccordionTrigger>
        <AccordionContent>
          Com certeza. Você pode criar e editar templates de mensagem para diversos eventos (chegada, pagamento, aniversário) e usar variáveis como '{"{nome}"}' para personalizar cada envio automaticamente.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-5">
        <AccordionTrigger>O sistema funciona em qualquer dispositivo?</AccordionTrigger>
        <AccordionContent>
          Sim, o Fidelize é uma aplicação web moderna e responsiva. Ele funciona em qualquer dispositivo com um navegador de internet, incluindo computadores, tablets e smartphones.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
          <FaqSection />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}