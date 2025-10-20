'use client';
import React, { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const FullscreenToggle: React.FC = () => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasAttemptedAutoFullscreen, setHasAttemptedAutoFullscreen] = useState(false);

    const toggleFullscreen = (isAutoAttempt = false) => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Erro ao tentar entrar em tela cheia: ${err.message} (${err.name})`);
                
                // Se for uma tentativa automática e falhar, instruímos o usuário
                if (isAutoAttempt) {
                    // Usamos um timeout para garantir que o prompt não seja bloqueado imediatamente
                    setTimeout(() => {
                        const confirm = window.confirm("Para uma melhor experiência, o Fidelize precisa de tela cheia. Clique em 'OK' e depois no botão de tela cheia (ou F11) para continuar.");
                        if (confirm) {
                            // Se o usuário clicar em OK, ele está ciente e pode tentar o botão manual
                        }
                    }, 500);
                }
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Tenta entrar em tela cheia automaticamente na montagem, se ainda não tentou
        if (!hasAttemptedAutoFullscreen) {
            // Usamos um pequeno timeout para garantir que o DOM esteja pronto
            setTimeout(() => {
                toggleFullscreen(true);
                setHasAttemptedAutoFullscreen(true);
            }, 1000);
        }

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [hasAttemptedAutoFullscreen]);

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleFullscreen(false)}
            className="absolute top-4 right-4 z-30 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            title={isFullscreen ? "Sair da Tela Cheia (F11)" : "Entrar em Tela Cheia (F11)"}
        >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </Button>
    );
};