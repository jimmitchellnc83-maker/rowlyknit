import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface KnittingModeContextValue {
  knittingMode: boolean;
  setKnittingMode: (on: boolean) => void;
}

const KnittingModeContext = createContext<KnittingModeContextValue | undefined>(undefined);

export function KnittingModeProvider({ children }: { children: ReactNode }) {
  const [knittingMode, setKnittingModeState] = useState(false);
  const setKnittingMode = useCallback((on: boolean) => setKnittingModeState(on), []);
  const value = useMemo(() => ({ knittingMode, setKnittingMode }), [knittingMode, setKnittingMode]);
  return (
    <KnittingModeContext.Provider value={value}>
      {children}
    </KnittingModeContext.Provider>
  );
}

export function useKnittingMode(): KnittingModeContextValue {
  const ctx = useContext(KnittingModeContext);
  if (!ctx) {
    return { knittingMode: false, setKnittingMode: () => {} };
  }
  return ctx;
}
