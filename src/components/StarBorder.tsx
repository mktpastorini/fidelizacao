import React, { ReactNode, ElementType } from 'react';
import { cn } from '@/lib/utils';

interface StarBorderProps {
  as?: ElementType;
  children: ReactNode;
  color?: string;
  speed?: number; // in seconds
  thickness?: number; // in pixels
  className?: string;
}

// Custom CSS for the border effect
const starBorderStyles = `
.star-border-container {
  position: relative;
  padding: 1px; /* Padding to ensure the border is visible outside the content */
  border-radius: 0.75rem; /* Match shadcn/ui rounded-lg */
  overflow: hidden;
}

.star-border-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    var(--star-color) 5%,
    transparent 10%,
    transparent 90%,
    var(--star-color) 95%,
    transparent 100%
  );
  animation: rotate var(--star-speed) linear infinite;
  z-index: 0;
}

.star-border-content {
  position: relative;
  z-index: 1;
  /* Ensure content fills the container and hides the border overflow */
  height: 100%;
  width: 100%;
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}
`;

export function StarBorder({
  as: Component = 'div',
  children,
  color = '#3b82f6', // blue-500
  speed = 5,
  thickness = 2,
  className,
}: StarBorderProps) {
  
  // We need to inject the custom styles and variables
  const styleVariables = {
    '--star-color': color,
    '--star-speed': `${speed}s`,
    '--star-thickness': `${thickness}px`,
    // The background size needs to be large enough to cover the rotation area
    '--star-bg-size': '400%', 
  } as React.CSSProperties;

  return (
    <>
      {/* Injecting styles globally or using a style tag is often necessary for complex CSS animations */}
      <style dangerouslySetInnerHTML={{ __html: starBorderStyles }} />
      <Component 
        className={cn("star-border-container", className)} 
        style={styleVariables}
      >
        <div className="star-border-content h-full w-full">
          {children}
        </div>
      </Component>
    </>
  );
}