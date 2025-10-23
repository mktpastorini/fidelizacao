'use client';
import React from 'react';

interface VideoBackgroundProps {
    videoUrl: string;
    onVideoEnded: () => void; // Nova prop
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({ videoUrl, onVideoEnded }) => {
    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
            <div className="absolute inset-0 bg-black/30 z-10" />
            <video
                key={videoUrl} // Força a remontagem quando a URL muda
                className="absolute inset-0 min-w-full min-h-full object-cover w-auto h-auto"
                autoPlay
                loop={false} // Desativamos o loop para que o evento 'onEnded' seja disparado
                onEnded={onVideoEnded} // Chamamos a função para carregar o próximo vídeo
            >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
};