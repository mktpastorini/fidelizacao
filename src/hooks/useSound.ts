import { useState, useCallback } from 'react';

export const useSound = (soundUrl: string) => {
  const [audio] = useState(() => {
    if (typeof Audio !== 'undefined') {
      return new Audio(soundUrl);
    }
    return null;
  });

  const playSound = useCallback(() => {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(error => {
        console.error("Error playing sound:", error);
      });
    }
  }, [audio]);

  return playSound;
};