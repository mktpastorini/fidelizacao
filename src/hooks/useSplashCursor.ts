import { useState, useEffect, useCallback } from 'react';

export function useSplashCursor() {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isSplashing, setIsSplashing] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsSplashing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsSplashing(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseDown, handleMouseUp]);

  return { cursorPos, isSplashing };
}