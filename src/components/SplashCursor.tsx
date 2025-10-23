import React from 'react';
import { motion } from 'framer-motion';
import { useSplashCursor } from '@/hooks/useSplashCursor';

export function SplashCursor() {
  const { cursorPos, isSplashing } = useSplashCursor();

  return (
    <motion.div
      className="fixed pointer-events-none z-[9999] rounded-full mix-blend-difference"
      style={{
        left: cursorPos.x,
        top: cursorPos.y,
        translateX: '-50%',
        translateY: '-50%',
      }}
      animate={{
        width: isSplashing ? 60 : 20,
        height: isSplashing ? 60 : 20,
        backgroundColor: isSplashing ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.5)',
        scale: isSplashing ? 0.8 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
      }}
    />
  );
}