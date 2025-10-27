import React, { createContext, useContext, useState, ReactNode } from 'react';

type PerformanceContextType = {
  isPerformanceModeEnabled: boolean;
  togglePerformanceMode: () => void;
};

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [isPerformanceModeEnabled, setIsPerformanceModeEnabled] = useState(false);

  const togglePerformanceMode = () => {
    setIsPerformanceModeEnabled(prev => !prev);
  };

  return (
    <PerformanceContext.Provider value={{ isPerformanceModeEnabled, togglePerformanceMode }}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}