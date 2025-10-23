import React, { useEffect, useRef, ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface AnimatedContentProps {
  children: ReactNode;
  distance?: number;
  direction?: 'vertical' | 'horizontal';
  reverse?: boolean;
  duration?: number;
  ease?: string;
  initialOpacity?: number;
  animateOpacity?: boolean;
  scale?: number;
  threshold?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

export function AnimatedContent({
  children,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  className = '',
  onComplete,
}: AnimatedContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Cleanup previous ScrollTriggers and tweens
    ScrollTrigger.getAll().forEach(t => t.kill());
    gsap.killTweensOf(el);

    const axis = direction === 'horizontal' ? 'x' : 'y';
    const offset = reverse ? -distance : distance;
    const startPct = (1 - threshold) * 100;

    // Set initial state
    gsap.set(el, {
      [axis]: offset,
      scale: scale,
      opacity: animateOpacity ? initialOpacity : 1,
    });

    // Animate to final state
    gsap.to(el, {
      [axis]: 0,
      scale: 1,
      opacity: 1,
      duration: duration,
      ease: ease,
      delay: delay,
      onComplete: onComplete,
      scrollTrigger: {
        trigger: el,
        start: `top ${startPct}%`,
        toggleActions: 'play none none none',
        once: true,
      },
    });

    return () => {
      // Cleanup on unmount
      gsap.killTweensOf(el);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [distance, direction, reverse, duration, ease, initialOpacity, animateOpacity, scale, threshold, delay, onComplete]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}