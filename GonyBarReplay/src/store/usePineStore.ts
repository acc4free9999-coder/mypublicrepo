import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_SOURCE = `//@version=5
indicator("EMA 20", overlay=true)
plot(ta.ema(close, 20), title="EMA 20", color=color.orange)`;

interface PineStore {
  source: string;
  activeSource: string | null;
  error: string | null;
  setSource: (source: string) => void;
  run: (source: string) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const usePineStore = create<PineStore>()(
  persist(
    (set) => ({
      source: DEFAULT_SOURCE,
      activeSource: null,
      error: null,
      setSource: (source) => set({ source }),
      run: (source) => set({ source, activeSource: source, error: null }),
      setError: (error) => set({ error }),
      clear: () => set({ activeSource: null, error: null }),
    }),
    {
      name: 'gony-bar-replay:pine',
      partialize: (state) => ({ source: state.source }),
    },
  ),
);
