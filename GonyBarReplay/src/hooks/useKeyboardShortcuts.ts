import { useEffect } from 'react';
import type { DrawingTool } from '@/drawings/types';
import { useDrawingStore } from '@/store/useDrawingStore';
import { useTradingStore } from '@/store/useTradingStore';

/** Alt-combos use e.code because Alt rewrites e.key on macOS. */
const TOOL_KEYS: Record<string, DrawingTool> = {
  KeyT: 'trendline',
  KeyH: 'hline',
  KeyJ: 'hray',
  KeyV: 'vline',
  KeyF: 'fib',
  KeyM: 'measure',
  KeyX: 'text',
  KeyC: 'callout',
};

/**
 * Space = play/pause, → = step forward, Esc = cancel cutoff selection / drawing tool,
 * Delete = remove selected drawing, Ctrl/⌘+Z = undo drawing, Alt+… = drawing tools.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const s = useTradingStore.getState();
      const d = useDrawingStore.getState();

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const tool = e.shiftKey ? (e.code === 'KeyR' ? 'rect' : undefined) : TOOL_KEYS[e.code];
        if (tool) {
          e.preventDefault();
          d.setTool(tool);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        d.undo();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        s.togglePlay();
      } else if (e.code === 'ArrowRight' && (s.replay.status === 'paused' || s.replay.status === 'playing')) {
        e.preventDefault();
        s.pause();
        s.stepForward();
      } else if (e.code === 'Escape') {
        if (s.replay.status === 'selecting') s.cancelSelection();
        if (d.draft || d.tool !== 'cursor') d.setTool('cursor');
        else d.select(null);
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && d.selectedId) {
        const sel = d.find(d.selectedId);
        if (sel && !sel.locked) {
          e.preventDefault();
          d.remove(sel.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
