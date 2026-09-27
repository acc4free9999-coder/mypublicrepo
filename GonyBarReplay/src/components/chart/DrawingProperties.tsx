import { Copy, Lock, LockOpen, Ruler, Trash } from 'lucide-react';
import type { ReactNode } from 'react';
import { DRAWING_COLORS, DRAWING_LABELS, isLine, isTextual, statsVisible, type Drawing, type LineDash } from '@/drawings/types';
import { cn } from '@/lib/format';
import { useDrawingStore } from '@/store/useDrawingStore';

const DASHES: { value: LineDash; label: string }[] = [
  { value: 'solid', label: '———' },
  { value: 'dashed', label: '– – –' },
  { value: 'dotted', label: '·····' },
];

/** Floating properties bar for the selected drawing (TradingView-style). */
export function DrawingProperties() {
  const selectedId = useDrawingStore((s) => s.selectedId);
  const editingTextId = useDrawingStore((s) => s.editingTextId);
  const drawing = useDrawingStore((s) => (s.selectedId ? s.find(s.selectedId) : undefined));
  const s = useDrawingStore.getState();
  if (!selectedId || !drawing) return null;

  const setStyle = (patch: Partial<Drawing['style']>) => {
    s.update(drawing.id, { style: { ...drawing.style, ...patch } }, true);
    if (!isTextual(drawing.type)) s.setDefaultStyle(patch);
  };
  const isText = isTextual(drawing.type);
  const hasStroke = !isText && drawing.type !== 'measure';

  const clone = () => s.duplicate(drawing.id);

  return (
    <div
      className="absolute inset-x-2 top-12 z-30 mx-auto flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1 text-xs shadow-xl backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="px-1 text-slate-400">{DRAWING_LABELS[drawing.type]}</span>
      <Sep />
      {drawing.type !== 'measure' && (
        <div className="flex items-center gap-0.5">
          {DRAWING_COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => setStyle({ color: c })}
              className={cn('h-4 w-4 rounded-full border', drawing.style.color === c ? 'border-white' : 'border-transparent')}
              style={{ background: c }}
            />
          ))}
          <input type="color" title="Custom color" value={drawing.style.color} onChange={(e) => setStyle({ color: e.target.value })} className="ml-0.5 h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0" />
        </div>
      )}
      {hasStroke && (
        <>
          <Sep />
          <select title="Line width" value={drawing.style.width} onChange={(e) => setStyle({ width: Number(e.target.value) })} className="rounded bg-slate-800 px-1 py-0.5 outline-none">
            {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w}px</option>)}
          </select>
          <select title="Line style" value={drawing.style.dash} onChange={(e) => setStyle({ dash: e.target.value as LineDash })} className="rounded bg-slate-800 px-1 py-0.5 outline-none">
            {DASHES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </>
      )}
      {isText && (
        <>
          <Sep />
          <select title="Font size" value={drawing.fontSize ?? 14} onChange={(e) => s.update(drawing.id, { fontSize: Number(e.target.value) }, true)} className="rounded bg-slate-800 px-1 py-0.5 outline-none">
            {[10, 12, 14, 16, 20, 24, 28, 36].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <textarea
            key={drawing.id}
            autoFocus={editingTextId === drawing.id}
            onFocus={(e) => {
              s.checkpoint();
              if (editingTextId === drawing.id) e.currentTarget.select();
            }}
            rows={1}
            value={drawing.text ?? ''}
            onChange={(e) => s.update(drawing.id, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
                s.startTextEdit(null);
              }
            }}
            placeholder="Text (Shift+Enter for new line)"
            className="w-44 resize-none rounded bg-slate-800 px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500"
          />
        </>
      )}
      {isLine(drawing.type) && (
        <>
          <Sep />
          <IconBtn title={statsVisible(drawing) ? 'Hide stats (price change, bars, angle)' : 'Show stats (price change, bars, angle)'} active={statsVisible(drawing)} onClick={() => s.update(drawing.id, { showStats: !statsVisible(drawing) }, true)}>
            <Ruler size={14} />
          </IconBtn>
        </>
      )}
      <Sep />
      <IconBtn title={drawing.locked ? 'Unlock' : 'Lock'} active={drawing.locked} onClick={() => s.update(drawing.id, { locked: !drawing.locked }, true)}>
        {drawing.locked ? <Lock size={14} /> : <LockOpen size={14} />}
      </IconBtn>
      <IconBtn title="Clone" onClick={clone}><Copy size={14} /></IconBtn>
      <IconBtn title="Remove (Delete)" onClick={() => s.remove(drawing.id)}><Trash size={14} /></IconBtn>
    </div>
  );
}

const Sep = () => <div className="mx-1 h-4 w-px bg-slate-700" />;

function IconBtn({ children, title, active, onClick }: { children: ReactNode; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className={cn('rounded p-1 hover:bg-slate-800', active ? 'text-blue-400' : 'text-slate-300')}>
      {children}
    </button>
  );
}
