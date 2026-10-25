import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PineInputValue, PineProgress } from '@/pine/runtime';

const DEFAULT_SOURCE = `//@version=5
indicator("EMA 20", overlay=true)
plot(ta.ema(close, 20), title="EMA 20", color=color.orange)`;

export interface PineScript {
  id: string;
  name: string;
  source: string;
}

const DEFAULT_SCRIPT: PineScript = { id: 'default', name: 'EMA 20', source: DEFAULT_SOURCE };

function createScriptId() {
  return `pine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PineStore {
  source: string;
  scripts: PineScript[];
  selectedScriptId: string;
  inputValues: Record<string, Record<string, PineInputValue>>;
  activeSource: string | null;
  error: string | null;
  execution: 'idle' | 'running' | 'ready';
  progress: PineProgress | null;
  setSource: (source: string) => void;
  setInputValue: (scriptId: string, inputId: string, value: PineInputValue) => void;
  selectScript: (id: string) => void;
  createScript: () => void;
  renameScript: (id: string, name: string) => void;
  duplicateScript: (id: string) => void;
  deleteScript: (id: string) => void;
  run: (source: string) => void;
  setError: (error: string | null) => void;
  setFailed: (error: string) => void;
  setProgress: (progress: PineProgress) => void;
  setReady: () => void;
  clear: () => void;
}

export const usePineStore = create<PineStore>()(
  persist(
    (set) => ({
      source: DEFAULT_SOURCE,
      scripts: [DEFAULT_SCRIPT],
      selectedScriptId: DEFAULT_SCRIPT.id,
      inputValues: {},
      activeSource: null,
      error: null,
      execution: 'idle',
      progress: null,
      setSource: (source) => set((state) => ({
        source,
        scripts: state.scripts.map((script) => script.id === state.selectedScriptId ? { ...script, source } : script),
      })),
      setInputValue: (scriptId, inputId, value) => set((state) => ({
        inputValues: {
          ...state.inputValues,
          [scriptId]: { ...state.inputValues[scriptId], [inputId]: value },
        },
      })),
      selectScript: (id) => set((state) => {
        const script = state.scripts.find((item) => item.id === id);
        return script
          ? { selectedScriptId: id, source: script.source, activeSource: null, error: null, execution: 'idle', progress: null }
          : state;
      }),
      createScript: () => set((state) => {
        const script: PineScript = {
          id: createScriptId(),
          name: `Pine Script ${state.scripts.length + 1}`,
          source: DEFAULT_SOURCE,
        };
        return {
          scripts: [...state.scripts, script],
          selectedScriptId: script.id,
          source: script.source,
          activeSource: null,
          error: null,
          execution: 'idle',
          progress: null,
        };
      }),
      renameScript: (id, name) => set((state) => {
        const trimmedName = name.trim();
        return trimmedName
          ? { scripts: state.scripts.map((script) => script.id === id ? { ...script, name: trimmedName } : script) }
          : state;
      }),
      duplicateScript: (id) => set((state) => {
        const original = state.scripts.find((script) => script.id === id);
        if (!original) return state;
        const script = { ...original, id: createScriptId(), name: `${original.name} copy` };
        return {
          scripts: [...state.scripts, script],
          selectedScriptId: script.id,
          source: script.source,
          activeSource: null,
          error: null,
          execution: 'idle',
          progress: null,
        };
      }),
      deleteScript: (id) => set((state) => {
        if (state.scripts.length <= 1 || !state.scripts.some((script) => script.id === id)) return state;
        const scripts = state.scripts.filter((script) => script.id !== id);
        if (id !== state.selectedScriptId) return { scripts };
        const nextScript = scripts[0];
        return {
          scripts,
          selectedScriptId: nextScript.id,
          source: nextScript.source,
          activeSource: null,
          error: null,
          execution: 'idle',
          progress: null,
        };
      }),
      run: (source) => set({ source, activeSource: source, error: null, execution: 'running', progress: null }),
      setError: (error) => set({ error }),
      setFailed: (error) => set({ error, execution: 'idle', progress: null }),
      setProgress: (progress) => set({ progress, execution: 'running' }),
      setReady: () => set({ execution: 'ready', progress: null, error: null }),
      clear: () => set({ activeSource: null, error: null, execution: 'idle', progress: null }),
    }),
    {
      name: 'gony-bar-replay:pine',
      partialize: (state) => ({
        source: state.source,
        scripts: state.scripts,
        selectedScriptId: state.selectedScriptId,
        inputValues: state.inputValues,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PineStore>;
        if (!persisted.scripts?.length) {
          if (persisted.source && persisted.source !== DEFAULT_SOURCE) {
            const migratedScript = { id: 'saved-script', name: 'My Pine Script', source: persisted.source };
            return {
              ...currentState,
              source: migratedScript.source,
              scripts: [migratedScript],
              selectedScriptId: migratedScript.id,
              inputValues: persisted.inputValues ?? {},
            };
          }
          return { ...currentState, source: persisted.source ?? currentState.source, inputValues: persisted.inputValues ?? {} };
        }
        const selectedScript = persisted.scripts.find((script) => script.id === persisted.selectedScriptId)
          ?? persisted.scripts[0];
        return {
          ...currentState,
          scripts: persisted.scripts,
          selectedScriptId: selectedScript.id,
          source: selectedScript.source,
          inputValues: persisted.inputValues ?? {},
        };
      },
    },
  ),
);
