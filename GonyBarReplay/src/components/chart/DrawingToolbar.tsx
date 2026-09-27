import {
  AlignVerticalSpaceAround,
  ArrowRightFromLine,
  Eye,
  EyeOff,
  Magnet,
  MessageSquare,
  MousePointer2,
  MoveHorizontal,
  MoveUpRight,
  Minus,
  PenLine,
  RectangleHorizontal,
  Ruler,
  SeparatorVertical,
  Slash,
  Trash,
  Type,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { DRAWING_LABELS, type DrawingTool } from '@/drawings/types';
import { cn } from '@/lib/format';
import { drawingsFor, useDrawingStore } from '@/store/useDrawingStore';
import { useTradingStore } from '@/store/useTradingStore';

const TOOL_GROUPS: { tool: DrawingTool; icon: LucideIcon; shortcut?: string }[][] = [
  [{ tool: 'cursor', icon: MousePointer2, shortcut: 'Esc' }],
  [
    { tool: 'trendline', icon: Slash, shortcut: 'Alt+T' },
    { tool: 'ray', icon: MoveUpRight },
    { tool: 'extended', icon: MoveHorizontal },
    { tool: 'hline', icon: Minus, shortcut: 'Alt+H' },
    { tool: 'hray', icon: ArrowRightFromLine, shortcut: 'Alt+J' },
    { tool: 'vline', icon: SeparatorVertical, shortcut: 'Alt+V' },
  ],
  [
    { tool: 'rect', icon: RectangleHorizontal, shortcut: 'Alt+Shift+R' },
    { tool: 'fib', icon: AlignVerticalSpaceAround, shortcut: 'Alt+F' },
    { tool: 'measure', icon: Ruler, shortcut: 'Alt+M' },
    { tool: 'text', icon: Type, shortcut: 'Alt+X' },
    { tool: 'callout', icon: MessageSquare, shortcut: 'Alt+C' },
  ],
];

export function DrawingToolbar() {
  const tool = useDrawingStore((s) => s.tool);
  const magnet = useDrawingStore((s) => s.magnet);
  const stay = useDrawingStore((s) => s.stayInDrawingMode);
  const hidden = useDrawingStore((s) => s.hidden);
  const canUndo = useDrawingStore((s) => s.past.length > 0);
  const symbol = useTradingStore((s) => s.symbol);
  const count = useDrawingStore((s) => drawingsFor(s, symbol).length);
  const d = useDrawingStore.getState();

  return (
    <nav className="flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-slate-800 bg-[#0f131b] py-2" aria-label="Drawing tools">
      {TOOL_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col items-center gap-0.5">
          {gi > 0 && <Sep />}
          {group.map(({ tool: t, icon: Icon, shortcut }) => {
            const label = t === 'cursor' ? 'Cursor' : DRAWING_LABELS[t];
            return (
              <ToolBtn key={t} title={shortcut ? `${label} (${shortcut})` : label} active={tool === t} onClick={() => d.setTool(tool === t && t !== 'cursor' ? 'cursor' : t)}>
                <Icon size={17} strokeWidth={1.75} />
              </ToolBtn>
            );
          })}
        </div>
      ))}
      <Sep />
      <ToolBtn title={`Magnet mode: snap to OHLC (${magnet ? 'on' : 'off'})`} active={magnet} onClick={d.toggleMagnet}><Magnet size={17} strokeWidth={1.75} /></ToolBtn>
      <ToolBtn title={`Stay in drawing mode (${stay ? 'on' : 'off'})`} active={stay} onClick={d.toggleStayInDrawingMode}><PenLine size={17} strokeWidth={1.75} /></ToolBtn>
      <ToolBtn title={hidden ? 'Show drawings' : 'Hide drawings'} active={hidden} onClick={d.toggleHidden}>{hidden ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}</ToolBtn>
      <Sep />
      <ToolBtn title="Undo (Ctrl/⌘+Z)" disabled={!canUndo} onClick={d.undo}><Undo2 size={17} strokeWidth={1.75} /></ToolBtn>
      <ToolBtn
        title={`Remove all ${symbol} drawings`}
        disabled={count === 0}
        onClick={() => confirm(`Remove all ${count} drawing(s) on ${symbol}?`) && d.removeAll(symbol)}
      >
        <Trash size={17} strokeWidth={1.75} />
      </ToolBtn>
    </nav>
  );
}

const Sep = () => <div className="my-1 h-px w-6 bg-slate-700/70" />;

function ToolBtn({ children, title, active, disabled, onClick }: { children: ReactNode; title: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30',
        active ? 'bg-blue-600/25 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
      )}
    >
      {children}
    </button>
  );
}
