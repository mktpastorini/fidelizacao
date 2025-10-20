'use client';
import React, { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const FullscreenToggle: React.FC = () => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Erro ao tentar entrar em tela cheia: ${err.message} (${err.name})`);
                // Informa o usuário que a ação requer interação manual
                alert("O navegador bloqueou a entrada automática em tela cheia. Por favor, pressione F11 (ou o botão de tela cheia do seu navegador) para uma melhor experiência.");
            });
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-30 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            title={isFullscreen ? "Sair da Tela Cheia (F11)" : "Entrar em Tela Cheia (F11)"}
        >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </Button>
    );
};