import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnchorPoint, Drawing, DrawingStyle, DrawingTool, DrawingType } from '@/drawings/types';

const MAX_UNDO = 100;

type BySymbol = Record<string, Drawing[]>;

export interface DrawingStore {
  tool: DrawingTool;
  magnet: boolean;
  /** Keep the current tool active after finishing a drawing. */
  stayInDrawingMode: boolean;
  hidden: boolean;
  defaultStyle: DrawingStyle;
  bySymbol: BySymbol;
  selectedId: string | null;
  editingTextId: string | null;
  /** In-progress drawing that follows the mouse. */
  draft: Drawing | null;
  past: BySymbol[];

  setTool: (tool: DrawingTool) => void;
  toggleMagnet: () => void;
  toggleStayInDrawingMode: () => void;
  toggleHidden: () => void;
  setDraft: (d: Drawing | null) => void;
  setDefaultStyle: (patch: Partial<DrawingStyle>) => void;
  create: (symbol: string, type: DrawingType, points: AnchorPoint[]) => Drawing;
  add: (d: Drawing) => void;
  /** Snapshot current state onto the undo stack (call once before a drag). */
  checkpoint: () => void;
  update: (id: string, patch: Partial<Drawing>, record?: boolean) => void;
  remove: (id: string) => void;
  /** Copy of a drawing (same points and style), selected after creation. */
  duplicate: (id: string) => void;
  removeAll: (symbol: string) => void;
  select: (id: string | null) => void;
  startTextEdit: (id: string | null) => void;
  undo: () => void;
  find: (id: string) => Drawing | undefined;
}

let seq = 0;
const newId = () => `drw-${Date.now().toString(36)}-${(++seq).toString(36)}`;

const mapAll = (by: BySymbol, fn: (list: Drawing[]) => Drawing[]): BySymbol => {
  const out: BySymbol = {};
  for (const [k, v] of Object.entries(by)) out[k] = fn(v);
  return out;
};

export const useDrawingStore = create<DrawingStore>()(
  persist(
    (set, get) => ({
      tool: 'cursor',
      magnet: false,
      stayInDrawingMode: false,
      hidden: false,
      defaultStyle: { color: '#2962ff', width: 2, dash: 'solid' },
      bySymbol: {},
      selectedId: null,
      editingTextId: null,
      draft: null,
      past: [],

      setTool: (tool) => set({ tool, draft: null, selectedId: tool === 'cursor' ? get().selectedId : null, editingTextId: null }),
      toggleMagnet: () => set((s) => ({ magnet: !s.magnet })),
      toggleStayInDrawingMode: () => set((s) => ({ stayInDrawingMode: !s.stayInDrawingMode })),
      toggleHidden: () => set((s) => ({ hidden: !s.hidden, selectedId: null, draft: null })),
      setDraft: (draft) => set({ draft }),
      setDefaultStyle: (patch) => set((s) => ({ defaultStyle: { ...s.defaultStyle, ...patch } })),

      create: (symbol, type, points) => {
        const { defaultStyle } = get();
        return {
          id: newId(),
          type,
          symbol,
          points,
          style: { ...defaultStyle, color: type === 'text' ? '#e2e8f0' : defaultStyle.color, dash: type === 'fib' ? 'dashed' : defaultStyle.dash },
          text: type === 'text' ? 'Text' : type === 'callout' ? 'Callout' : undefined,
          fontSize: type === 'text' ? 16 : type === 'callout' ? 14 : undefined,
          createdAt: Date.now(),
        };
      },

      add: (d) =>
        set((s) => ({
          past: [...s.past, s.bySymbol].slice(-MAX_UNDO),
          bySymbol: { ...s.bySymbol, [d.symbol]: [...(s.bySymbol[d.symbol] ?? []), d] },
          selectedId: d.id,
        })),

      checkpoint: () => set((s) => ({ past: [...s.past, s.bySymbol].slice(-MAX_UNDO) })),

      update: (id, patch, record = false) =>
        set((s) => ({
          past: record ? [...s.past, s.bySymbol].slice(-MAX_UNDO) : s.past,
          bySymbol: mapAll(s.bySymbol, (list) => (list.some((d) => d.id === id) ? list.map((d) => (d.id === id ? { ...d, ...patch } : d)) : list)),
        })),

      remove: (id) =>
        set((s) => ({
          past: [...s.past, s.bySymbol].slice(-MAX_UNDO),
          bySymbol: mapAll(s.bySymbol, (list) => list.filter((d) => d.id !== id)),
          selectedId: s.selectedId === id ? null : s.selectedId,
          editingTextId: s.editingTextId === id ? null : s.editingTextId,
        })),

      duplicate: (id) => {
        const d = get().find(id);
        if (!d) return;
        const copy = get().create(d.symbol, d.type, d.points.map((p) => ({ ...p })));
        get().add({ ...copy, style: { ...d.style }, text: d.text, fontSize: d.fontSize, showStats: d.showStats });
      },

      removeAll: (symbol) =>
        set((s) => ({
          past: [...s.past, s.bySymbol].slice(-MAX_UNDO),
          bySymbol: { ...s.bySymbol, [symbol]: [] },
          selectedId: null,
          editingTextId: null,
          draft: null,
        })),

      select: (selectedId) => set((s) => ({ selectedId, editingTextId: selectedId && s.editingTextId === selectedId ? selectedId : null })),
      startTextEdit: (id) => set({ editingTextId: id, selectedId: id ?? get().selectedId }),

      undo: () =>
        set((s) => {
          if (!s.past.length) return {};
          const prev = s.past[s.past.length - 1];
          return { bySymbol: prev, past: s.past.slice(0, -1), selectedId: null, editingTextId: null, draft: null };
        }),

      find: (id) => {
        for (const list of Object.values(get().bySymbol)) {
          const d = list.find((x) => x.id === id);
          if (d) return d;
        }
        return undefined;
      },
    }),
    {
      name: 'gony-bar-replay.drawings.v1',
      partialize: (s) => ({ bySymbol: s.bySymbol, magnet: s.magnet, stayInDrawingMode: s.stayInDrawingMode, defaultStyle: s.defaultStyle }),
    },
  ),
);

const EMPTY: Drawing[] = [];
export const drawingsFor = (s: DrawingStore, symbol: string) => s.bySymbol[symbol] ?? EMPTY;
