import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

type PageActionsContextType = {
  pageActions: ReactNode | null;
  setPageActions: (actions: ReactNode | null) => void;
};

const PageActionsContext = createContext<PageActionsContextType | undefined>(undefined);

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [pageActions, setPageActionsState] = useState<ReactNode | null>(null);

  const setPageActions = useCallback((actions: ReactNode | null) => {
    setPageActionsState(actions);
  }, []);

  const contextValue = useMemo(() => ({ pageActions, setPageActions }), [pageActions, setPageActions]);

  return (
    <PageActionsContext.Provider value={contextValue}>
      {children}
    </PageActionsContext.Provider>
  );
}

export function usePageActions() {
  const context = useContext(PageActionsContext);
  if (context === undefined) {
    throw new Error('usePageActions must be used within a PageActionsProvider');
  }
  return context;
}